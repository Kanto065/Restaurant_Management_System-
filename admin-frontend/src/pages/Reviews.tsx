import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Star } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';

interface Review {
  id: string;
  authorName: string;
  authorLocation: string | null;
  rating: number;
  comment: string | null;
  isPublished: boolean;
  createdAt: string;
}

const emptyForm = { authorName: '', authorLocation: '', rating: 5, comment: '', isPublished: true };

const Reviews = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: () => api.get<Review[]>('/api/admin/reviews'),
  });
  const reviews = reviewsQuery.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });

  const createMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) => api.post('/api/admin/reviews', payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Review added.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof emptyForm }) => api.put(`/api/admin/reviews/${id}`, payload),
    onSuccess: () => { toast({ title: 'Success', description: 'Review updated.' }); invalidate(); resetForm(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/reviews/${id}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Review deleted.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
    onSettled: () => setDeleteId(null),
  });

  const togglePublishedMutation = useMutation({
    mutationFn: (r: Review) => api.put(`/api/admin/reviews/${r.id}`, {
      authorName: r.authorName, authorLocation: r.authorLocation ?? '', rating: r.rating, comment: r.comment ?? '', isPublished: !r.isPublished,
    }),
    onSuccess: invalidate,
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName.trim()) {
      toast({ title: 'Validation Error', description: 'Reviewer name is required.', variant: 'destructive' });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (r: Review) => {
    setEditing(r);
    setForm({ authorName: r.authorName, authorLocation: r.authorLocation ?? '', rating: r.rating, comment: r.comment ?? '', isPublished: r.isPublished });
    setIsDialogOpen(true);
  };

  const resetForm = () => { setForm(emptyForm); setEditing(null); setIsDialogOpen(false); };
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (reviewsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground">Manage the reviews shown on your storefront's Reviews page</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : resetForm())}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Review
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Review' : 'Add Review'}</DialogTitle>
              <DialogDescription>Reviews you add here are published on the storefront's Reviews page.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authorName">Name *</Label>
                  <Input id="authorName" value={form.authorName} onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))} required disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorLocation">Location</Label>
                  <Input id="authorLocation" value={form.authorLocation} onChange={(e) => setForm((f) => ({ ...f, authorLocation: e.target.value }))} placeholder="e.g. Swansea" disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating (1-5)</Label>
                <Input id="rating" type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)) }))} disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">Comment</Label>
                <Textarea id="comment" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} rows={3} disabled={isSubmitting} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isPublished">Published</Label>
                  <p className="text-xs text-muted-foreground">Unpublished reviews are hidden from the storefront</p>
                </div>
                <Switch id="isPublished" checked={form.isPublished} onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} disabled={isSubmitting} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : editing ? 'Update Review' : 'Add Review'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reviews ({reviews.length})</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No reviews yet.</p>
          ) : (
            <div className="divide-y">
              {reviews.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.authorName}</span>
                      {r.authorLocation && <span className="text-xs text-muted-foreground">{r.authorLocation}</span>}
                      <span className="flex items-center text-amber-500">
                        {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-500" />)}
                      </span>
                      {!r.isPublished && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={r.isPublished} onCheckedChange={() => togglePublishedMutation.mutate(r)} />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the review.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Reviews;
