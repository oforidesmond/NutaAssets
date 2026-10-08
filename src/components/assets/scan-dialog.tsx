"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the decoded text (tag or serial). */
  onScan: (value: string) => void;
  title?: string;
};

/**
 * Camera barcode/QR scanner. Falls back gracefully if permission denied.
 */
export function ScanDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan barcode or QR",
}: Props) {
  const reactId = useId();
  const elementId = `qr-reader-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const callbacksRef = useRef({ onScan, onOpenChange });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacksRef.current = { onScan, onOpenChange };
  }, [onScan, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const start = async () => {
      setBusy(true);
      setError(null);
      try {
        await new Promise((r) => window.setTimeout(r, 50));
        if (cancelled) return;

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (cancelled) return;
            const value = decoded.trim();
            if (!value) return;
            let fill = value;
            try {
              const url = new URL(value);
              const match = url.pathname.match(/\/a\/([^/]+)/);
              if (match?.[1]) fill = match[1];
            } catch {
              // not a URL — use raw barcode text
            }
            callbacksRef.current.onScan(fill);
            callbacksRef.current.onOpenChange(false);
            toast.success("Scanned");
          },
          () => {
            /* ignore frame-level miss */
          },
        );
        if (!cancelled) setBusy(false);
      } catch (err) {
        if (cancelled) return;
        setBusy(false);
        setError(
          err instanceof Error
            ? err.message
            : "Camera unavailable. Enter the value manually.",
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        void scanner.stop().catch(() => undefined);
      }
      try {
        scanner?.clear();
      } catch {
        /* ignore */
      }
    };
  }, [open, elementId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Point the camera at a barcode or QR code. You can always type the
            value instead.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <div
            id={elementId}
            className="min-h-[240px] overflow-hidden rounded-md border bg-black/90"
          />
        ) : null}
        {busy && !error && (
          <p className="text-sm text-muted-foreground">Starting camera…</p>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onOpenChange(false)}
              >
                Close and type manually
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
