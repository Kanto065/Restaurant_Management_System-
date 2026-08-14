import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export type ModifierGroupType = 'Modifier' | 'Variation';

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  groupType: ModifierGroupType;
  options: ModifierOption[];
}

// `key` is a client-only stable identity for drag reordering and React keys - unrelated to
// the server `id`, which new (unsaved) options don't have yet.
type OptionForm = { key: string; id?: string; name: string; priceDelta: string; isDefault: boolean };

const newOptionKey = () => crypto.randomUUID();
const emptyOption = (): OptionForm => ({ key: newOptionKey(), name: '', priceDelta: '0', isDefault: false });

interface ModifierGroupDialogProps {
  itemId: string;
  group: ModifierGroup | null; // null = creating a new group
  onClose: () => void;
}

export function ModifierGroupDialog({ itemId, group, onClose }: ModifierGroupDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<ModifierGroupType>('Modifier');
  const [isRequired, setIsRequired] = useState(true);
  const [singleSelect, setSingleSelect] = useState(true);
  const [options, setOptions] = useState<OptionForm[]>([emptyOption(), emptyOption()]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRects = useRef(new Map<string, DOMRect>());

  useEffect(() => {
    if (group) {
      setName(group.name);
      setGroupType(group.groupType);
      setIsRequired(group.isRequired);
      setSingleSelect(group.maxSelect <= 1);
      setOptions(group.options.map((o) => ({ key: newOptionKey(), id: o.id, name: o.name, priceDelta: o.priceDelta.toString(), isDefault: o.isDefault })));
    } else {
      setName('');
      setGroupType('Modifier');
      setIsRequired(true);
      setSingleSelect(true);
      setOptions([emptyOption(), emptyOption()]);
    }
  }, [group]);

  // A Variation must always resolve to exactly one price, so it can't be optional or multi-select.
  useEffect(() => {
    if (groupType === 'Variation') {
      setIsRequired(true);
      setSingleSelect(true);
    }
  }, [groupType]);

  // FLIP: same approach as Menu Categories/Variant Groups reordering.
  const captureRectsForFlip = () => {
    prevRects.current.clear();
    for (const [key, el] of rowRefs.current) prevRects.current.set(key, el.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (prevRects.current.size === 0) return;
    for (const [key, el] of rowRefs.current) {
      const prev = prevRects.current.get(key);
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
  }, [options.map((o) => o.key).join(',')]);

  const handleDrop = (targetKey: string) => {
    setDragOverKey(null);
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return; }
    setOptions((prev) => {
      const next = [...prev];
      const from = next.findIndex((o) => o.key === dragKey);
      const to = next.findIndex((o) => o.key === targetKey);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    captureRectsForFlip();
    setDragKey(null);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'menu-items', itemId, 'modifier-groups'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        minSelect: isRequired ? 1 : 0,
        maxSelect: singleSelect ? 1 : options.length,
        isRequired,
        groupType,
        options: options
          .filter((o) => o.name.trim())
          .map((o) => ({ id: o.id ?? null, name: o.name, priceDelta: parseFloat(o.priceDelta) || 0, isDefault: o.isDefault, isAvailable: true })),
      };
      return group
        ? api.put(`/api/admin/modifier-groups/${group.id}`, payload)
        : api.post(`/api/admin/menu-items/${itemId}/modifier-groups`, payload);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: group ? 'Option group updated.' : 'Option group added.' });
      invalidate();
      onClose();
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Group name is required.', variant: 'destructive' });
      return;
    }
    if (options.filter((o) => o.name.trim()).length < 2) {
      toast({ title: 'Validation Error', description: 'Add at least two options (e.g. Plain, Spicy).', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const updateOption = (key: string, patch: Partial<OptionForm>) =>
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Option Group' : 'Add Option Group'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name *</Label>
            <Input id="groupName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Choose Type" required />
          </div>

          <div className="space-y-2">
            <Label>Group Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGroupType('Variation')}
                className={`text-left border rounded-lg p-3 text-sm ${groupType === 'Variation' ? 'border-primary bg-primary/5' : 'border-input'}`}
              >
                <p className="font-medium">Variation</p>
                <p className="text-xs text-muted-foreground mt-0.5">Replaces the item's price (e.g. Chicken £8.95 vs Lamb £9.95)</p>
              </button>
              <button
                type="button"
                onClick={() => setGroupType('Modifier')}
                className={`text-left border rounded-lg p-3 text-sm ${groupType === 'Modifier' ? 'border-primary bg-primary/5' : 'border-input'}`}
              >
                <p className="font-medium">Modifier / Extra</p>
                <p className="text-xs text-muted-foreground mt-0.5">Adds to the price (e.g. +£0.50 for extra cheese)</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Customer must pick one</Label>
              <p className="text-xs text-muted-foreground">
                {groupType === 'Variation' ? 'Always on for a Variation - it must resolve to exactly one price' : 'Off lets them skip this group entirely'}
              </p>
            </div>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} disabled={groupType === 'Variation'} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Single choice</Label>
              <p className="text-xs text-muted-foreground">
                {groupType === 'Variation' ? 'Always on for a Variation' : 'Off allows picking more than one option'}
              </p>
            </div>
            <Switch checked={singleSelect} onCheckedChange={setSingleSelect} disabled={groupType === 'Variation'} />
          </div>

          <div className="space-y-2">
            <Label>Options *</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              {groupType === 'Variation'
                ? "Enter each option's full price - the item's own base price should be left at £0.00"
                : 'Enter how much each option adds to the price'}
            </p>
            {options.map((option) => (
              <div
                key={option.key}
                ref={(el) => { if (el) rowRefs.current.set(option.key, el); else rowRefs.current.delete(option.key); }}
                draggable={options.length > 1}
                onDragStart={() => setDragKey(option.key)}
                onDragOver={(e) => { e.preventDefault(); if (dragKey && dragKey !== option.key) setDragOverKey(option.key); }}
                onDragLeave={() => setDragOverKey((k) => (k === option.key ? null : k))}
                onDragEnd={() => { setDragKey(null); setDragOverKey(null); }}
                onDrop={() => handleDrop(option.key)}
                className={`flex items-center gap-2 border-t-2 transition-colors ${
                  dragKey === option.key ? 'opacity-40' : dragOverKey === option.key ? 'border-t-primary' : 'border-t-transparent'
                }`}
              >
                {options.length > 1 && <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />}
                <Input
                  value={option.name}
                  onChange={(e) => updateOption(option.key, { name: e.target.value })}
                  placeholder="e.g., Plain"
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={option.priceDelta}
                  onChange={(e) => updateOption(option.key, { priceDelta: e.target.value })}
                  placeholder={groupType === 'Variation' ? '0.00' : '+0.00'}
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setOptions((prev) => prev.filter((o) => o.key !== option.key))}
                  disabled={options.length <= 2}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions((prev) => [...prev, emptyOption()])}>
              <Plus className="w-4 h-4 mr-2" />Add Option
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : group ? 'Save Changes' : 'Add Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
