import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Download, ShoppingBag, Truck, ExternalLink } from 'lucide-react';

const STOREFRONT_BASE_URL = import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://www.porttennanttandoori.co.uk';

const LINKS = [
  { key: 'collection', label: 'Collection', icon: ShoppingBag, url: `${STOREFRONT_BASE_URL}/menu?type=Collection`, qrTitle: 'Collection Order' },
  { key: 'delivery', label: 'Delivery', icon: Truck, url: `${STOREFRONT_BASE_URL}/menu?type=Delivery`, qrTitle: 'Delivery Order' },
] as const;

const Takeout = () => {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      toast({ title: 'Copied!', description: 'Order URL copied to clipboard' });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy URL', variant: 'destructive' });
    }
  };

  const handleDownloadQR = async (url: string, title: string, filename: string) => {
    try {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png`;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const padding = 80;
          const qrSize = size - padding * 2;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, padding, padding, qrSize, qrSize);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 52px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(title, size / 2, 55);
          ctx.font = '32px Arial';
          ctx.fillText('Scan to order', size / 2, size - 28);

          canvas.toBlob((blob) => {
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = filename;
              link.href = blobUrl;
              link.click();
              URL.revokeObjectURL(blobUrl);
              toast({ title: 'Downloaded!', description: 'QR code saved' });
              resolve();
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/png', 1.0);
        };
        img.onerror = () => reject(new Error('Failed to load QR code'));
        img.src = qrApiUrl;
      });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate QR code', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Takeout & Delivery</h1>
        <p className="text-muted-foreground">Share these URLs or QR codes so customers can order for collection or delivery</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {LINKS.map(({ key, label, icon: Icon, url, qrTitle }) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Icon className="w-5 h-5" />{label} Order URL</CardTitle>
              <CardDescription>Customers open this link to browse the menu and place a {label.toLowerCase()} order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 break-all text-sm font-mono">{url}</div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleCopy(key, url)}>
                  {copiedKey === key ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Copy className="w-4 h-4 mr-2" />Copy URL</>}
                </Button>
                <Button variant="outline" onClick={() => window.open(url, '_blank')}><ExternalLink className="w-4 h-4" /></Button>
              </div>
              <div className="flex justify-center pt-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
                  alt={`${label} QR Code`}
                  className="w-40 h-40 rounded-lg border"
                />
              </div>
              <Button className="w-full" variant="outline" onClick={() => handleDownloadQR(url, qrTitle, `${key}-qr-code.png`)}>
                <Download className="w-4 h-4 mr-2" />Download QR Code (HD)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Share the URL or display the QR code at your counter, on packaging, or on flyers.</li>
            <li>Customers scan/open it, browse the menu, and place their order as a guest or member.</li>
            <li>New orders appear instantly in your <strong>Orders</strong> page.</li>
            <li>Update status and estimated time as you prepare each order.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default Takeout;
