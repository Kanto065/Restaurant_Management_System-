import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
}

type OptionForm = { id?: string; name: string; priceDelta: string; isDefault: boolean };

const emptyOption: OptionForm = { name: '', priceDelta: '0', isDefault: false };

interface ModifierGroupDialogProps {
  itemId: string;
  group: ModifierGroup | null; // null = creating a new group
  onClose: () => void;
}

export function ModifierGroupDialog({ itemId, group, onClose }: ModifierGroupDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [singleSelect, setSingleSelect] = useState(true);
  const [options, setOptions] = useState<OptionForm[]>([{ ...emptyOption }, { ...emptyOption }]);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setIsRequired(group.isRequired);
      setSingleSelect(group.maxSelect <= 1);
      setOptions(group.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta.toString(), isDefault: o.isDefault })));
    } else {
      setName('');
      setIsRequired(true);
      setSingleSelect(true);
      setOptions([{ ...emptyOption }, { ...emptyOption }]);
    }
  }, [group]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'menu-items', itemId, 'modifier-groups'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        minSelect: isRequired ? 1 : 0,
        maxSelect: singleSelect ? 1 : options.length,
        isRequired,
        options: options
          .filter((o) => o.name.trim())
          .map((o) => ({ id: o.id ?? null, name: o.name, priceDelta: parseFloat(o.priceDelta) || 0, isDefault: o.isDefault, isAvailable: true })),
      };
      return group
        ? api.put(`/api/admin/modifier-groups/${group.id}`, payload)
        : api.post(`/api/admin/menu-items/${itemId}/modifier-groups`, payload);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: group ? 'Variant group updated.' : 'Variant group added.' });
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
      toast({ title: 'Validation Error', description: 'Add at least two variants (e.g. Plain, Spicy).', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const updateOption = (index: number, patch: Partial<OptionForm>) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Variant Group' : 'Add Variant Group'}</DialogTitle>
          <DialogDescription>
            e.g. "Choose Type" with variants Plain / Spicy, or "Choose Flavour" with several options.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name *</Label>
            <Input id="groupName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Choose Type" required />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Customer must pick one</Label>
              <p className="text-xs text-muted-foreground">Off lets them skip this group entirely</p>
            </div>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Single choice</Label>
              <p className="text-xs text-muted-foreground">Off allows picking more than one variant</p>
            </div>
            <Switch checked={singleSelect} onCheckedChange={setSingleSelect} />
          </div>

          <div className="space-y-2">
            <Label>Variants *</Label>
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={option.name}
                  onChange={(e) => updateOption(i, { name: e.target.value })}
                  placeholder="e.g., Plain"
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={option.priceDelta}
                  onChange={(e) => updateOption(i, { priceDelta: e.target.value })}
                  placeholder="+0.00"
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={options.length <= 2}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions((prev) => [...prev, { ...emptyOption }])}>
              <Plus className="w-4 h-4 mr-2" />Add Variant
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
