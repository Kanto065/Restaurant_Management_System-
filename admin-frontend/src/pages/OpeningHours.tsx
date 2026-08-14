import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Clock3 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The API serializes DayOfWeek as its enum name ("Sunday"..."Saturday"), not its numeric value.
interface OpeningHour { id: string; dayOfWeek: string; openTime: string | null; closeTime: string | null; isClosed: boolean }
interface OpeningHourException { id: string; date: string; openTime: string | null; closeTime: string | null; isClosed: boolean; note: string | null }

type DayForm = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };

const OpeningHoursPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<DayForm[]>(
    DAY_NAMES.map((_, i) => ({ dayOfWeek: i, openTime: '17:00', closeTime: '22:00', isClosed: false }))
  );

  const hoursQuery = useQuery({ queryKey: ['admin', 'opening-hours'], queryFn: () => api.get<OpeningHour[]>('/api/admin/opening-hours') });
  const exceptionsQuery = useQuery({ queryKey: ['admin', 'opening-hours', 'exceptions'], queryFn: () => api.get<OpeningHourException[]>('/api/admin/opening-hours/exceptions') });

  useEffect(() => {
    const existing = hoursQuery.data?.data;
    if (!existing || existing.length === 0) return;
    setDays((prev) => prev.map((d) => {
      const match = existing.find((h) => h.dayOfWeek === DAY_NAMES[d.dayOfWeek]);
      return match ? { dayOfWeek: d.dayOfWeek, openTime: match.openTime ?? '17:00', closeTime: match.closeTime ?? '22:00', isClosed: match.isClosed } : d;
    }));
  }, [hoursQuery.data]);

  const saveWeekMutation = useMutation({
    mutationFn: () => api.put('/api/admin/opening-hours', days.map((d) => ({
      dayOfWeek: d.dayOfWeek, openTime: d.isClosed ? null : d.openTime, closeTime: d.isClosed ? null : d.closeTime, isClosed: d.isClosed,
    }))),
    onSuccess: () => { toast({ title: 'Success', description: 'Opening hours saved.' }); queryClient.invalidateQueries({ queryKey: ['admin', 'opening-hours'] }); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionOpen, setExceptionOpen] = useState('17:00');
  const [exceptionClose, setExceptionClose] = useState('21:30');
  const [exceptionClosed, setExceptionClosed] = useState(false);
  const [exceptionNote, setExceptionNote] = useState('This week only');

  const createExceptionMutation = useMutation({
    mutationFn: () => api.post('/api/admin/opening-hours/exceptions', {
      date: exceptionDate, openTime: exceptionClosed ? null : exceptionOpen, closeTime: exceptionClosed ? null : exceptionClose,
      isClosed: exceptionClosed, note: exceptionNote || null,
    }),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Exception added.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'opening-hours', 'exceptions'] });
      setExceptionDialogOpen(false);
      setExceptionDate('');
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/opening-hours/exceptions/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Exception removed.' }); queryClient.invalidateQueries({ queryKey: ['admin', 'opening-hours', 'exceptions'] }); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const exceptions = exceptionsQuery.data?.data ?? [];

  if (hoursQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading opening hours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Opening Hours</h1>
        <p className="text-muted-foreground">Your regular weekly schedule, plus one-off overrides for holidays or early closures</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>Shown on your storefront and used to display "We're Open" / "We're Closed"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {days.map((day, i) => (
            <div key={day.dayOfWeek} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-3">
              <Label className="font-medium">{DAY_NAMES[day.dayOfWeek]}</Label>
              <Input type="time" value={day.openTime} disabled={day.isClosed}
                onChange={(e) => setDays((prev) => prev.map((d, idx) => idx === i ? { ...d, openTime: e.target.value } : d))} />
              <Input type="time" value={day.closeTime} disabled={day.isClosed}
                onChange={(e) => setDays((prev) => prev.map((d, idx) => idx === i ? { ...d, closeTime: e.target.value } : d))} />
              <div className="flex items-center gap-2">
                <Switch checked={!day.isClosed} onCheckedChange={(v) => setDays((prev) => prev.map((d, idx) => idx === i ? { ...d, isClosed: !v } : d))} />
                <span className="text-sm text-muted-foreground w-14">{day.isClosed ? 'Closed' : 'Open'}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={() => saveWeekMutation.mutate()} disabled={saveWeekMutation.isPending}>
              {saveWeekMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save Weekly Schedule'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upcoming Exceptions</CardTitle>
              <CardDescription>One-off overrides, e.g. "5:00pm - 9:30pm, this week only"</CardDescription>
            </div>
            <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Add Exception</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Opening Hours Exception</DialogTitle>
                  <DialogDescription>Overrides the regular schedule for a single date.</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createExceptionMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="exceptionDate">Date *</Label>
                    <Input id="exceptionDate" type="date" value={exceptionDate} onChange={(e) => setExceptionDate(e.target.value)} required />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exceptionClosed">Closed all day</Label>
                    <Switch id="exceptionClosed" checked={exceptionClosed} onCheckedChange={setExceptionClosed} />
                  </div>
                  {!exceptionClosed && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="exceptionOpen">Open Time</Label>
                        <Input id="exceptionOpen" type="time" value={exceptionOpen} onChange={(e) => setExceptionOpen(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="exceptionClose">Close Time</Label>
                        <Input id="exceptionClose" type="time" value={exceptionClose} onChange={(e) => setExceptionClose(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="exceptionNote">Note</Label>
                    <Input id="exceptionNote" value={exceptionNote} onChange={(e) => setExceptionNote(e.target.value)} placeholder="This week only" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setExceptionDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createExceptionMutation.isPending || !exceptionDate}>
                      {createExceptionMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>) : 'Add Exception'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <div className="text-center py-8">
              <Clock3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No upcoming exceptions.</p>
            </div>
          ) : (
            <div className="divide-y">
              {exceptions.map((ex) => (
                <div key={ex.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{new Date(ex.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <p className="text-sm text-muted-foreground">
                      {ex.isClosed ? 'Closed' : `${ex.openTime} – ${ex.closeTime}`}{ex.note ? ` · ${ex.note}` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteExceptionMutation.mutate(ex.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OpeningHoursPage;
