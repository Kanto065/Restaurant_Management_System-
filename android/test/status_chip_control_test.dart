import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_terminal/theme.dart';
import 'package:pos_terminal/widgets/status_chip_control.dart';

void main() {
  const options = [
    ChipOption('Pending', 0),
    ChipOption('Confirmed', 1),
    ChipOption('Completed', 2),
  ];

  Widget wrap(Widget child) => MaterialApp(theme: buildPosTheme(Brightness.light), home: Scaffold(body: child));

  testWidgets('shows the current value label', (tester) async {
    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Confirmed',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () {},
      onAdvance: () {},
      onJumpToTerminal: () {},
    )));

    expect(find.text('Confirmed'), findsOneWidget);
  });

  testWidgets('tapping the label triggers onTapValue', (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Pending',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () => tapped = true,
      onAdvance: () {},
      onJumpToTerminal: () {},
    )));

    await tester.tap(find.text('Pending'));
    await tester.pump();
    expect(tapped, isTrue);
  });

  testWidgets('the advance (→) button calls onAdvance', (tester) async {
    var advanced = false;
    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Pending',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () {},
      onAdvance: () => advanced = true,
      onJumpToTerminal: () {},
    )));

    await tester.tap(find.byIcon(Icons.arrow_forward_rounded));
    await tester.pump();
    expect(advanced, isTrue);
  });

  testWidgets('the terminal (check) button is disabled once already at the terminal value', (tester) async {
    var jumped = false;
    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Completed',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () {},
      onAdvance: () {},
      onJumpToTerminal: () => jumped = true,
    )));

    await tester.tap(find.byIcon(Icons.check_rounded), warnIfMissed: false);
    await tester.pump();
    expect(jumped, isFalse);
  });

  testWidgets('the terminal (check) button jumps when not already there', (tester) async {
    var jumped = false;
    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Pending',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () {},
      onAdvance: () {},
      onJumpToTerminal: () => jumped = true,
    )));

    await tester.tap(find.byIcon(Icons.check_rounded));
    await tester.pump();
    expect(jumped, isTrue);
  });

  testWidgets('renders an overflow button only when onOverflow is provided', (tester) async {
    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Pending',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () {},
      onAdvance: () {},
      onJumpToTerminal: () {},
    )));
    expect(find.text('⋮'), findsNothing);

    await tester.pumpWidget(wrap(StatusChipControl(
      value: 'Pending',
      options: options,
      terminalValue: 'Completed',
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
      onTapValue: () {},
      onAdvance: () {},
      onJumpToTerminal: () {},
      onOverflow: () {},
    )));
    expect(find.text('⋮'), findsOneWidget);
  });
}
