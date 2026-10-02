import 'package:image/image.dart' as img;

/// A minimal software model of the Aures ODP 333 in its default mode
/// (Font A 12x24 dots, 42 columns, 512-dot print area, code page PC437).
///
/// It interprets the raw ESC/POS bytes independently of ReceiptBuilder's
/// own text preview, so tests catch problems in the actual byte stream:
/// unknown commands, lines that would wrap on paper, wrong characters.
class SimulatedPrinter {
  static const int columns = 42;
  static const int cellW = 12;
  static const int cellH = 24;
  static const int paperDots = 576; // 80mm at 203dpi
  static const int printDots = columns * cellW;

  final List<PrintedLine> lines = [];
  final List<String> errors = [];
  bool cut = false;
  bool drawerOpened = false;

  int _align = 0;
  bool _bold = false;
  bool _dw = false;
  bool _dh = false;
  int _codePage = 0;
  final List<PrintedChar> _buf = [];

  static final Map<int, String> _cp437High = {
    0x80: 'Ç', 0x81: 'ü', 0x82: 'é', 0x83: 'â', 0x84: 'ä', 0x85: 'à',
    0x86: 'å', 0x87: 'ç', 0x88: 'ê', 0x89: 'ë', 0x8A: 'è', 0x8B: 'ï',
    0x8C: 'î', 0x8D: 'ì', 0x8E: 'Ä', 0x8F: 'Å', 0x90: 'É', 0x91: 'æ',
    0x92: 'Æ', 0x93: 'ô', 0x94: 'ö', 0x95: 'ò', 0x96: 'û', 0x97: 'ù',
    0x98: 'ÿ', 0x99: 'Ö', 0x9A: 'Ü', 0x9B: '¢', 0x9C: '£', 0x9D: '¥',
    0xA0: 'á', 0xA1: 'í', 0xA2: 'ó', 0xA3: 'ú', 0xA4: 'ñ', 0xA5: 'Ñ',
    0xAB: '½', 0xAC: '¼', 0xF8: '°',
  };

  SimulatedPrinter.run(List<int> b) {
    int i = 0;
    int arg(int k) {
      if (i + k >= b.length) {
        errors.add('truncated command at byte $i');
        return 0;
      }
      return b[i + k];
    }

    while (i < b.length) {
      final int c = b[i];
      if (c == 0x1B) {
        final int cmd = arg(1);
        switch (cmd) {
          case 0x40: // ESC @
            _align = 0; _bold = false; _dw = false; _dh = false; _codePage = 0;
            i += 2;
          case 0x61: // ESC a n
            if (_buf.isNotEmpty) errors.add('ESC a mid-line is ignored by the printer');
            _align = arg(2) % 48;
            i += 3;
          case 0x45: // ESC E n
            _bold = arg(2) & 1 == 1;
            i += 3;
          case 0x74: // ESC t n
            _codePage = arg(2);
            i += 3;
          case 0x52: // ESC R n
            if (arg(2) != 0) errors.add('international charset ${arg(2)} remaps ASCII');
            i += 3;
          case 0x70: // ESC p m t1 t2 (cash drawer pulse)
            drawerOpened = true;
            i += 5;
          case 0x64: // ESC d n
            _newline();
            for (int k = 1; k < arg(2); k++) {
              _newline();
            }
            i += 3;
          default:
            errors.add('unsupported command ESC 0x${cmd.toRadixString(16)} at byte $i');
            i += 2;
        }
      } else if (c == 0x1D) {
        final int cmd = arg(1);
        switch (cmd) {
          case 0x21: // GS ! n
            _dw = arg(2) & 0x70 != 0;
            _dh = arg(2) & 0x07 != 0;
            i += 3;
          case 0x56: // GS V m
            if (_buf.isNotEmpty) _newline();
            cut = true;
            i += 3;
          default:
            errors.add('unsupported command GS 0x${cmd.toRadixString(16)} at byte $i');
            i += 2;
        }
      } else if (c == 0x0A) {
        _newline();
        i += 1;
      } else if (c < 0x20) {
        errors.add('stray control byte 0x${c.toRadixString(16)} at byte $i');
        i += 1;
      } else {
        if (_codePage != 0 && c >= 0x80) errors.add('code page $_codePage is not PC437');
        final String ch = c < 0x80 ? String.fromCharCode(c) : (_cp437High[c] ?? '\u{FFFD}');
        final int w = _dw ? 2 : 1;
        if (_width + w > columns) {
          errors.add('line overflows paper and wraps: "${_buf.map((e) => e.ch).join()}$ch..."');
          _newline();
        }
        _buf.add(PrintedChar(ch, _bold, _dw, _dh));
        i += 1;
      }
    }
    if (_buf.isNotEmpty) errors.add('text left in buffer without LF');
  }

  int get _width => _buf.fold(0, (s, e) => s + (e.dw ? 2 : 1));

  void _newline() {
    final int w = _width;
    final int offset = switch (_align) {
      1 => (columns - w) * cellW ~/ 2,
      2 => (columns - w) * cellW,
      _ => 0,
    };
    lines.add(PrintedLine(List.of(_buf), offset, _buf.any((e) => e.dh)));
    _buf.clear();
  }

  /// Text of each printed line as it would sit on the paper
  /// (double-width characters occupy two columns).
  List<String> get text => lines.map((l) {
        final String lead = ' ' * (l.offsetDots ~/ cellW);
        return lead + l.chars.map((e) => e.dw ? '${e.ch} ' : e.ch).join();
      }).toList();

  /// Renders the paper as an image, one pixel per printer dot.
  List<int> renderPng() {
    final int height = lines.fold(0, (s, l) => s + (l.dh ? cellH * 2 : cellH)) + 60;
    final paper = img.Image(paperDots, height);
    img.fill(paper, img.getColor(255, 255, 255));
    final int margin = (paperDots - printDots) ~/ 2;
    final ink = img.getColor(20, 20, 20);
    int y = 30;
    for (final line in lines) {
      int x = margin + line.offsetDots;
      final int rowH = line.dh ? cellH * 2 : cellH;
      for (final ch in line.chars) {
        final int w = ch.dw ? cellW * 2 : cellW;
        final int h = ch.dh ? cellH * 2 : cellH;
        final glyph = img.Image(24, 28);
        img.drawString(glyph, img.arial_24, 0, 0, ch.ch, color: ink);
        if (ch.bold) img.drawString(glyph, img.arial_24, 1, 0, ch.ch, color: ink);
        final scaled = img.copyResize(glyph, width: w, height: h);
        img.copyInto(paper, scaled, dstX: x, dstY: y + rowH - h, blend: true);
        x += w;
      }
      y += rowH;
    }
    return img.encodePng(paper);
  }
}

class PrintedChar {
  PrintedChar(this.ch, this.bold, this.dw, this.dh);
  final String ch;
  final bool bold;
  final bool dw;
  final bool dh;
}

class PrintedLine {
  PrintedLine(this.chars, this.offsetDots, this.dh);
  final List<PrintedChar> chars;
  final int offsetDots;
  final bool dh;
}
