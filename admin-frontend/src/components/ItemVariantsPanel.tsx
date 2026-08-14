import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
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

  const groupsQuery = useQuery({
    queryKey: ['admin', 'menu-items', itemId, 'modifier-groups'],
    queryFn: () => api.get<ModifierGroup[]>(`/api/admin/menu-items/${itemId}/modifier-groups`),
  });
  const groups = groupsQuery.data?.data ?? [];
  const canShowAsRows = groups.length === 1 && groups[0].groupType === 'Variation';

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => api.delete(`/api/admin/modifier-groups/${groupId}`),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Variant group removed.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'menu-items', itemId, 'modifier-groups'] });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  return (
    <div className="bg-muted/40 rounded-lg p-3 space-y-2">
      {groupsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />Loading variants...
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">No variants yet - this item is added as-is.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="bg-background rounded-md p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
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

      <Button variant="outline" size="sm" onClick={() => setDialogGroup('new')}>
        <Plus className="w-4 h-4 mr-2" />Add Variant Group
      </Button>

      {canShowAsRows && (
        <div className="flex items-center justify-between bg-background rounded-md p-2.5">
          <div className="space-y-0.5">
            <Label className="text-sm">List variants as separate rows</Label>
            <p className="text-xs text-muted-foreground">
              Shows each variant as its own priced row with an instant Add button, no customise popup
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
