import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_terminal/api/models.dart';
import 'package:pos_terminal/theme.dart';
import 'package:pos_terminal/widgets/filter_sheet.dart';

void main() {
  final statuses = [
    OrderStatusDefinition(id: '1', name: 'Pending', displayOrder: 0, countsAsPending: true, countsAsCompleted: false, isDefault: true),
    OrderStatusDefinition(id: '2', name: 'Confirmed', displayOrder: 1, countsAsPending: true, countsAsCompleted: false, isDefault: false),
    OrderStatusDefinition(id: '3', name: 'Completed', displayOrder: 2, countsAsPending: false, countsAsCompleted: true, isDefault: false),
  ];
  final paymentStatuses = [
    PaymentStatusDefinition(id: '1', name: 'Pending', displayOrder: 0, isDefault: true),
    PaymentStatusDefinition(id: '2', name: 'Paid', displayOrder: 1, isDefault: false),
  ];

  testWidgets('lists every configured order status and payment status', (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
      theme: buildPosTheme(Brightness.light),
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showOrderFilterSheet(context, current: const OrderFilter(), statuses: statuses, paymentStatuses: paymentStatuses),
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('All statuses'), findsOneWidget);
    expect(find.text('Pending'), findsWidgets); // appears in both status + payment sections
    expect(find.text('Confirmed'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('All payments'), findsOneWidget);
    expect(find.text('Paid'), findsOneWidget);
  });

  testWidgets('selecting a status pill and applying returns it in the result', (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    OrderFilter? captured;
    await tester.pumpWidget(MaterialApp(
      theme: buildPosTheme(Brightness.light),
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              captured = await showOrderFilterSheet(context, current: const OrderFilter(), statuses: statuses, paymentStatuses: paymentStatuses);
            },
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Confirmed'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(find.text('Apply filters'), 200, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Apply filters'));
    await tester.pumpAndSettle();

    expect(captured?.status, 'Confirmed');
  });

  testWidgets('Clear all returns an empty filter', (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    OrderFilter? captured;
    await tester.pumpWidget(MaterialApp(
      theme: buildPosTheme(Brightness.light),
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              captured = await showOrderFilterSheet(
                context,
                current: const OrderFilter(status: 'Confirmed', paymentStatus: 'Paid'),
                statuses: statuses,
                paymentStatuses: paymentStatuses,
              );
            },
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(find.text('Clear all'), 200, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.text('Clear all'));
    await tester.pumpAndSettle();

    expect(captured?.isActive, isFalse);
  });
}
