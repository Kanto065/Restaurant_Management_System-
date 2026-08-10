import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';
import { getImageUrl } from '@/config/api';
import { Image as ImageIcon, Loader2, Upload } from 'lucide-react';

interface ImageUploadFieldProps {
  value: string | null | undefined;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

export function ImageUploadField({ value, onChange, label, className }: ImageUploadFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelected = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload<{ url: string }>('/api/admin/uploads/image', formData);
      if (result.data) onChange(result.data.url);
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof ApiError ? error.message : 'Could not upload the image.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div className="flex items-start gap-4">
        {value ? (
          <div className="w-32 h-32 border rounded-lg overflow-hidden bg-muted shrink-0">
            <img src={getImageUrl(value)} alt={label ?? 'Uploaded image'} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted shrink-0">
            <ImageIcon className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" />{value ? 'Replace Image' : 'Upload Image'}</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">JPEG, PNG, or WebP. Max 5MB.</p>
        </div>
      </div>
    </div>
  );
}
