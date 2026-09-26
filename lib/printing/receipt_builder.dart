import 'dart:typed_data';

enum ReceiptAlign { left, center, right }

/// Builds raw ESC/POS bytes for the Aures ODP 333 (80mm, 42 columns in
/// Font A) together with a plain-text preview of exactly the same layout.
///
/// esc_pos_utils_plus's Generator is deliberately not used here:
///  * it prefixes every line with ESC $ (absolute print position), which
///    overrides ESC a, so centred text printed flush-left;
///  * it encodes text as Latin-1, so '£' went out as 0xA3, which is 'ú' in
///    the printer's CP437 code page;
///  * its 80mm profile assumes 48 columns, but the ODP 333 prints 42, so
///    every padded line and divider wrapped onto a second line.
class ReceiptBuilder {
  ReceiptBuilder({this.width = 42});

  /// Characters per line at normal size.
  final int width;

  final List<int> _bytes = [];
  final List<String> _preview = [];

  static const int _esc = 0x1B;
  static const int _gs = 0x1D;
  static const int _lf = 0x0A;

  Uint8List get bytes => Uint8List.fromList(_bytes);
  List<String> get preview => List.unmodifiable(_preview);

  /// ESC @ (reset), ESC t 0 (code page PC437), ESC R 0 (USA charset).
  void reset() {
    _bytes.addAll([_esc, 0x40, _esc, 0x74, 0x00, _esc, 0x52, 0x00]);
  }

  /// Prints [text], word-wrapped to the line budget for the chosen size.
  void text(
    String text, {
    ReceiptAlign align = ReceiptAlign.left,
    bool bold = false,
    bool doubleWidth = false,
    bool doubleHeight = false,
  }) {
    final int budget = doubleWidth ? width ~/ 2 : width;
    for (final line in _wrap(text, budget)) {
      _emit(line, align: align, bold: bold, doubleWidth: doubleWidth, doubleHeight: doubleHeight);
    }
  }

  /// Prints [left] flush-left and [right] flush-right on the same line.
  /// If [left] is too long it wraps; [right] stays on the first line.
  void leftRight(
    String left,
    String right, {
    bool bold = false,
    bool doubleWidth = false,
    bool doubleHeight = false,
    int indent = 0,
  }) {
    // [indent] only shifts the left text; right-hand prices stay flush.
    final int budget = (doubleWidth ? width ~/ 2 : width) - indent;
    final int leftBudget = budget - right.length - 1;
    final List<String> leftLines = _wrap(left, leftBudget > 0 ? leftBudget : budget);
    final String pad = ' ' * indent;
    for (int i = 0; i < leftLines.length; i++) {
      final String line = i == 0
          ? leftLines[i] + ' ' * (budget - leftLines[i].length - right.length).clamp(1, budget) + right
          : '    ${leftLines[i]}';
      _emit('$pad$line', bold: bold, doubleWidth: doubleWidth, doubleHeight: doubleHeight);
    }
  }

  void divider([String char = '-']) => _emit(char * width);

  void blank([int lines = 1]) {
    for (int i = 0; i < lines; i++) {
      _bytes.add(_lf);
      _preview.add('');
    }
  }

  /// Feeds paper past the cutter, then full cut (GS V 0).
  void cut({int feedLines = 5}) {
    _bytes.addAll([_esc, 0x64, feedLines, _gs, 0x56, 0x30]);
  }

  void _emit(
    String line, {
    ReceiptAlign align = ReceiptAlign.left,
    bool bold = false,
    bool doubleWidth = false,
    bool doubleHeight = false,
  }) {
    final int size = (doubleWidth ? 0x10 : 0) | (doubleHeight ? 0x01 : 0);
    _bytes.addAll([_esc, 0x61, align.index]); // ESC a n
    _bytes.addAll([_esc, 0x45, bold ? 1 : 0]); // ESC E n
    _bytes.addAll([_gs, 0x21, size]); // GS ! n
    _bytes.addAll(encodeCp437(line));
    _bytes.add(_lf);
    if (bold || size != 0 || align != ReceiptAlign.left) {
      _bytes.addAll([_esc, 0x61, 0, _esc, 0x45, 0, _gs, 0x21, 0]);
    }

    // Preview: double-width characters take two columns.
    final String shown = doubleWidth ? line.split('').join(' ') : line;
    final int slack = width - shown.length;
    switch (align) {
      case ReceiptAlign.left:
        _preview.add(shown);
      case ReceiptAlign.center:
        _preview.add(' ' * (slack > 0 ? slack ~/ 2 : 0) + shown);
      case ReceiptAlign.right:
        _preview.add(' ' * (slack > 0 ? slack : 0) + shown);
    }
  }

  static List<String> _wrap(String text, int budget) {
    if (text.length <= budget) return [text];
    final List<String> lines = [];
    String current = '';
    for (final word in text.split(' ')) {
      String w = word;
      while (w.length > budget) {
        if (current.isNotEmpty) {
          lines.add(current);
          current = '';
        }
        lines.add(w.substring(0, budget));
        w = w.substring(budget);
      }
      if (current.isEmpty) {
        current = w;
      } else if (current.length + 1 + w.length <= budget) {
        current = '$current $w';
      } else {
        lines.add(current);
        current = w;
      }
    }
    if (current.isNotEmpty) lines.add(current);
    return lines;
  }

  static const Map<String, int> _cp437 = {
    '£': 0x9C, 'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84,
    'à': 0x85, 'å': 0x86, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8A,
    'ï': 0x8B, 'î': 0x8C, 'ì': 0x8D, 'Ä': 0x8E, 'Å': 0x8F, 'É': 0x90,
    'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96,
    'ù': 0x97, 'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9A, '¢': 0x9B, '¥': 0x9D,
    'á': 0xA0, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4, 'Ñ': 0xA5,
    '°': 0xF8, '½': 0xAB, '¼': 0xAC,
  };

  static const Map<String, String> _substitutes = {
    '’': "'", '‘': "'", '´': "'", '“': '"', '”': '"', '–': '-', '—': '-',
    '•': '.', '…': '...', '€': 'EUR', ' ': ' ',
  };

  /// Encodes [text] for code page PC437 (the ODP 333's default).
  static List<int> encodeCp437(String text) {
    final List<int> out = [];
    for (final rune in text.runes) {
      final String ch = String.fromCharCode(rune);
      if (rune >= 0x20 && rune < 0x7F) {
        out.add(rune);
      } else if (_cp437.containsKey(ch)) {
        out.add(_cp437[ch]!);
      } else if (_substitutes.containsKey(ch)) {
        out.addAll(_substitutes[ch]!.codeUnits);
      } else {
        out.add(0x3F); // '?'
      }
    }
    return out;
  }
}
