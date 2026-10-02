import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/hooks/useCurrency';
import { api, ApiError } from '@/lib/api';

interface Line { name: string; count: number; amount: number }
interface SalesReport {
  from: string; to: string; orderCount: number; grossSales: number; discounts: number; sales: number;
  refunds: number; net: number; byPaymentMethod: Line[]; bySource: Line[]; byCategory: Line[]; byItem: Line[]; refundsByMethod: Line[];
}

const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time
const SOURCE_LABEL: Record<string, string> = { Web: 'Online', Pos: 'POS', Kiosk: 'Kiosk' };

function toCsv(r: SalesReport): string {
  const rows: (string | number)[][] = [
    ['Sales report', r.from === r.to ? r.from : `${r.from} to ${r.to}`], [],
    ['Orders', r.orderCount], ['Gross sales', r.grossSales], ['Discounts', r.discounts], ['Sales', r.sales], ['Refunds', r.refunds], ['Net', r.net],
  ];
  const section = (title: string, lines: Line[], countLabel: string) => {
    rows.push([], [title, countLabel, 'Amount'], ...lines.map((l) => [l.name, l.count, l.amount]));
  };
  section('By payment method', r.byPaymentMethod, 'Payments');
  section('By source', r.bySource.map((l) => ({ ...l, name: SOURCE_LABEL[l.name] ?? l.name })), 'Orders');
  section('By category', r.byCategory, 'Qty');
  section('By item', r.byItem, 'Qty');
  section('Refunds by method', r.refundsByMethod, 'Refunds');
  return rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function download(report: SalesReport) {
  const url = URL.createObjectURL(new Blob([toCsv(report)], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), {
    href: url, download: `sales-${report.from}${report.from === report.to ? '' : `-to-${report.to}`}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function Breakdown({ title, lines, countLabel, money, labels }: {
  title: string; lines: Line[]; countLabel: string; money: (n: number) => string; labels?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {lines.length === 0 ? <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing in this period.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead className="pl-6"> </TableHead><TableHead className="text-right">{countLabel}</TableHead><TableHead className="pr-6 text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.name}>
                  <TableCell className="pl-6">{labels?.[l.name] ?? l.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.count}</TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{money(l.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

const Reports = () => {
  const symbol = useCurrency();
  const money = (n: number) => `${n < 0 ? '-' : ''}${symbol}${Math.abs(n).toFixed(2)}`;
  const [mode, setMode] = useState<'daily' | 'range'>('daily');
  const [day, setDay] = useState(today());
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const path = mode === 'daily' ? `/api/admin/reports/daily?date=${day}` : `/api/admin/reports/range?from=${from}&to=${to}`;
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'report', path], queryFn: () => api.get<SalesReport>(path), retry: false });
  const report = data?.data;
  const featureOff = error instanceof ApiError && error.errorCode === 'FEATURE_DISABLED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Completed online and POS orders, less refunds</p>
        </div>
        {report && <Button variant="outline" onClick={() => download(report)}><Download className="w-4 h-4 mr-2" />Export CSV</Button>}
      </div>

      {featureOff ? (
        <Card className="max-w-xl"><CardContent className="flex items-start gap-4 p-6">
          <BarChart3 className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Sales reports aren't enabled</h2>
            <p className="mt-1 text-sm text-muted-foreground">Please contact your platform provider if you'd like to use them.</p>
          </div>
        </CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'daily' | 'range')}>
              <TabsList><TabsTrigger value="daily">One day</TabsTrigger><TabsTrigger value="range">Date range</TabsTrigger></TabsList>
            </Tabs>
            {mode === 'daily' ? (
              <div className="space-y-1.5"><Label htmlFor="day">Day</Label>
                <Input id="day" type="date" value={day} max={today()} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-44" /></div>
            ) : (
              <>
                <div className="space-y-1.5"><Label htmlFor="from">From</Label>
                  <Input id="from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-44" /></div>
                <div className="space-y-1.5"><Label htmlFor="to">To</Label>
                  <Input id="to" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-44" /></div>
              </>
            )}
          </div>

          {error && !featureOff && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          {isLoading || !report ? (
            !error && <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: 'Net sales', value: money(report.net), hint: 'after discounts and refunds' },
                  { label: 'Orders', value: String(report.orderCount), hint: report.orderCount ? `avg ${money(report.sales / report.orderCount)}` : '' },
                  { label: 'Discounts', value: money(report.discounts), hint: `gross ${money(report.grossSales)}` },
                  { label: 'Refunds', value: money(report.refunds), hint: '' },
                ].map((s) => (
                  <Card key={s.label}><CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
                    {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
                  </CardContent></Card>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Breakdown title="By payment method" lines={report.byPaymentMethod} countLabel="Payments" money={money} />
                <Breakdown title="By source" lines={report.bySource} countLabel="Orders" money={money} labels={SOURCE_LABEL} />
                <Breakdown title="By category" lines={report.byCategory} countLabel="Qty" money={money} />
                <Breakdown title="Refunds" lines={report.refundsByMethod} countLabel="Refunds" money={money} />
              </div>
              <Breakdown title="By item" lines={report.byItem} countLabel="Qty" money={money} />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
