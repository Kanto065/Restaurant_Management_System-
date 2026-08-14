import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, GripVertical } from 'lucide-react';
import { api } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { ModifierGroupDialog, type ModifierGroup } from '@/components/ModifierGroupDialog';

interface ItemVariantsPanelProps {
  itemId: string;
  showVariantsAsRows: boolean;
  onToggleShowVariantsAsRows: (value: boolean) => void;
}

export function ItemVariantsPanel({ itemId, showVariantsAsRows, onToggleShowVariantsAsRows }: ItemVariantsPanelProps) {
  const { toast } = useToast();
  const currency = useCurrency();
  const queryClient = useQueryClient();
  const [dialogGroup, setDialogGroup] = useState<ModifierGroup | null | 'new'>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  const queryKey = ['admin', 'menu-items', itemId, 'modifier-groups'];
  const groupsQuery = useQuery({
    queryKey,
    queryFn: () => api.get<ModifierGroup[]>(`/api/admin/menu-items/${itemId}/modifier-groups`),
  });
  const groups = groupsQuery.data?.data ?? [];
  const canShowAsRows = groups.length === 1 && groups[0].groupType === 'Variation';

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => api.delete(`/api/admin/modifier-groups/${groupId}`),
    onSuccess: () => { toast({ title: 'Success', description: 'Option group removed.' }); invalidate(); },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.put(`/api/admin/menu-items/${itemId}/modifier-groups/reorder`, { orderedIds }),
    onSuccess: invalidate,
    onError: (error: Error) => { toast({ title: 'Error', description: error.message, variant: 'destructive' }); invalidate(); },
  });

  // Same FLIP approach as Menu Categories reordering.
  const captureRectsForFlip = () => {
    prevRects.current.clear();
    for (const [id, el] of rowRefs.current) prevRects.current.set(id, el.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    for (const [id, el] of rowRefs.current) {
      const prev = prevRects.current.get(id);
      if (!prev) continue;
      const next = el.getBoundingClientRect();
      const deltaY = prev.top - next.top;
      if (deltaY === 0) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 220ms ease';
        el.style.transform = '';
      });
    }
    prevRects.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.map((g) => g.id).join(',')]);

  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = groups.map((g) => g.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);

    captureRectsForFlip();
    queryClient.setQueryData(queryKey, (old: { data: ModifierGroup[] } | undefined) => {
      if (!old) return old;
      const byId = new Map(old.data.map((g) => [g.id, g]));
      return { ...old, data: ids.map((id) => byId.get(id)!) };
    });
    reorderMutation.mutate(ids);
  };

  return (
    <div className="bg-muted/40 rounded-lg p-3 space-y-2">
      <Button variant="outline" size="sm" onClick={() => setDialogGroup('new')}>
        <Plus className="w-4 h-4 mr-2" />Add Option Group
      </Button>

      {groupsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />Loading options...
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">No option groups yet - this item is added as-is.</p>
      ) : (
        groups.map((group) => (
          <div
            key={group.id}
            ref={(el) => { if (el) rowRefs.current.set(group.id, el); else rowRefs.current.delete(group.id); }}
            draggable={groups.length > 1}
            onDragStart={() => setDragId(group.id)}
            onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== group.id) setDragOverId(group.id); }}
            onDragLeave={() => setDragOverId((id) => (id === group.id ? null : id))}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            onDrop={() => handleDrop(group.id)}
            className={`bg-background rounded-md p-2.5 border-t-2 transition-colors ${
              dragId === group.id ? 'opacity-40' : dragOverId === group.id ? 'border-t-primary' : 'border-t-transparent'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {groups.length > 1 && <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />}
                <span className="font-medium text-sm truncate">{group.name}</span>
                <Badge variant={group.groupType === 'Variation' ? 'default' : 'outline'} className="text-xs">{group.groupType}</Badge>
                {group.isRequired && <Badge variant="outline" className="text-xs">Required</Badge>}
                {group.maxSelect > 1 && <Badge variant="outline" className="text-xs">Multi-select</Badge>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialogGroup(group)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(group.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {group.options.map((o) => (
                <Badge key={o.id} variant="secondary" className="text-xs font-normal">
                  {o.name}{o.priceDelta !== 0 && ` (${o.priceDelta > 0 ? '+' : ''}${currency}${o.priceDelta.toFixed(2)})`}
                </Badge>
              ))}
            </div>
          </div>
        ))
      )}

      {canShowAsRows && (
        <div className="flex items-center justify-between bg-background rounded-md p-2.5">
          <div className="space-y-0.5">
            <Label className="text-sm">List as rows</Label>
            <p className="text-xs text-muted-foreground">
              Shows each option as its own priced row with an instant Add button, no customise popup
            </p>
          </div>
          <Switch checked={showVariantsAsRows} onCheckedChange={onToggleShowVariantsAsRows} />
        </div>
      )}

      {dialogGroup && (
        <ModifierGroupDialog
          itemId={itemId}
          group={dialogGroup === 'new' ? null : dialogGroup}
          onClose={() => setDialogGroup(null)}
        />
      )}
    </div>
  );
}
