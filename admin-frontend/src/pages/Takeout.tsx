import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Download, ShoppingBag, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface TableData {
  _id: string;
  tableNumber: string;
  uniqueUrl: string;
  fullUrl: string;
  isActive: boolean;
}

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:8081';

const Takeout = () => {
  const [takeoutTable, setTakeoutTable] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTakeoutTable();
  }, []);

  const fetchTakeoutTable = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<{ tables: TableData[]; count: number }>('/api/tables');
      if (response.success && response.data) {
        const found = response.data.tables.find(t => t.uniqueUrl === 'takeout');
        setTakeoutTable(found || null);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to load takeout info', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const takeoutUrl = takeoutTable?.fullUrl || `${FRONTEND_URL}/takeout`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(takeoutUrl);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Takeout URL copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy URL', variant: 'destructive' });
    }
  };

  const handleDownloadQR = async () => {
    try {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(takeoutUrl)}&format=png`;
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
          ctx.fillText('Takeout Order', size / 2, 55);

          ctx.font = '32px Arial';
          ctx.fillText('Scan to order for takeout', size / 2, size - 28);

          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = 'takeout-qr-code.png';
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
              toast({ title: 'Downloaded!', description: 'Takeout QR code saved' });
              resolve();
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/png', 1.0);
        };
        img.onerror = () => reject(new Error('Failed to load QR code'));
        img.src = qrApiUrl;
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to generate QR code', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!takeoutTable) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Takeout</h1>
          <p className="text-muted-foreground">Manage takeout orders</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Takeout not set up</h3>
            <p className="text-muted-foreground">Run the seed script to create the takeout entry.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Takeout</h1>
        <p className="text-muted-foreground">Share this URL or QR code so customers can place takeout orders</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* URL Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Takeout Order URL
            </CardTitle>
            <CardDescription>
              Customers open this link to browse the menu and place a takeout order
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 break-all text-sm font-mono">
              {takeoutUrl}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCopy}>
                {copied ? <><Check className="w-4 h-4 mr-2" />Copied!</> : <><Copy className="w-4 h-4 mr-2" />Copy URL</>}
              </Button>
              <Button variant="outline" onClick={() => window.open(takeoutUrl, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Card */}
        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
            <CardDescription>
              Print and display this QR code at your counter for easy takeout ordering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(takeoutUrl)}`}
                alt="Takeout QR Code"
                className="w-48 h-48 rounded-lg border"
              />
            </div>
            <Button className="w-full" variant="outline" onClick={handleDownloadQR}>
              <Download className="w-4 h-4 mr-2" />
              Download QR Code (HD)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Share the URL or display the QR code at your counter or on your packaging.</li>
            <li>Customers scan/open it, browse the menu, and place their order.</li>
            <li>The order appears in your <strong>Orders</strong> page under table "Takeout".</li>
            <li>Mark it paid and ready just like any other order.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default Takeout;
