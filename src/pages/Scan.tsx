import { useEffect, useRef, useState } from 'react';
import { useStore, findPartByQr } from '../useStore';
import { codeFromScanText } from '../core';
import { Button, toast, usePageMeta } from '../ui';
import { PartSearchPicker } from '../modals';
import { QrImage } from '../qr';

type ScanState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unsupported' | 'error';

export function ScanPage({ go, prefill }: { go: (p: string) => void; prefill: string }) {
  usePageMeta(
    'Scan QR Code',
    'Identify any automobile part instantly — scan its QR label with the camera or enter the code manually to open stock and location details.',
    '/#/scan',
  );
  const { parts } = useStore();
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualCode, setManualCode] = useState(prefill);
  const [error, setError] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [lookup, setLookup] = useState<null | 'found' | 'notfound' | 'invalid'>(null);
  const [lastResolved, setLastResolved] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const flashTrackRef = useRef<MediaStreamTrack | null>(null);
  const lockRef = useRef(false);
  const jsqrRef = useRef<typeof import('jsqr')['default'] | null>(null);

  // Run the pending manual code exactly once when deep-linked (?qr=…)
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefill && !prefillDone.current) {
      prefillDone.current = true;
      resolveCode(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    flashTrackRef.current = null;
    setFlashOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => () => stopCamera(), []);

  const handleDecoded = (text: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    stopCamera();
    resolveCode(text);
    setTimeout(() => { lockRef.current = false; }, 800);
  };

  const resolveCode = (raw: string) => {
    // Deep-link QRs contain a full URL — extract the INV-/QR- token first.
    const code = codeFromScanText(raw).trim();
    if (!code) { setLookup('invalid'); setLastResolved(code); return; }
    const part = findPartByQr(code);
    if (part) {
      setLookup('found');
      setLastResolved(code);
      toast('ok', `Matched ${part.partNumber} — ${part.partName}`);
      setTimeout(() => go(`/part/${part.id}`), 450);
    } else {
      const plausible = /^(QR-|INV-|[A-Z]{2,4}-?\d{3,})/i.test(code);
      setLookup(plausible ? 'notfound' : 'invalid');
      setLastResolved(code);
    }
  };

  const startCamera = async () => {
    setError('');
    setLookup(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanState('unsupported');
      return;
    }      setScanState('starting');
    // jsqr (~15 KB gzip) is only fetched when the camera is actually started.
    if (!jsqrRef.current) jsqrRef.current = (await import('jsqr')).default;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      flashTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setScanState('scanning');
      tick();
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        setScanState('denied');
      } else {
        setScanState('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const tick = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsqrRef.current?.(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) handleDecoded(code.data);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const toggleFlash = async () => {
    const track = flashTrackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !flashOn }] } as unknown as MediaTrackConstraints);
      setFlashOn((v) => !v);
    } catch {
      toast('warn', 'Flashlight is not supported on this camera.');
    }
  };

  const submitManual = () => resolveCode(manualCode);

  const sampleQrs = parts.slice(0, 6);

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1>Scan QR Code</h1>
          <p className="page-sub">Point the camera at the part label, or enter the code manually below.</p>
        </div>
      </header>

      <div className="scan-tabs">
        <button className={mode === 'camera' ? 'active' : ''} onClick={() => { stopCamera(); setMode('camera'); setLookup(null); }}>
          Camera Scan
        </button>
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => { stopCamera(); setMode('manual'); setLookup(null); }}>
          Manual Entry
        </button>
      </div>

      {mode === 'camera' && (
        <section className="card scan-card">
          <div className={`scan-frame ${scanState}`}>
            <video ref={videoRef} muted playsInline className="scan-video" />
            <canvas ref={canvasRef} className="scan-hidden-canvas" />
            <div className="scan-reticle" aria-hidden>
              <span className="corner tl" /><span className="corner tr" />
              <span className="corner bl" /><span className="corner br" />
            </div>
            {scanState !== 'scanning' && (
              <div className="scan-overlay">
                {scanState === 'idle' && (
                  <>
                    <p className="scan-big">Camera is off</p>
                    <p className="scan-hint">Click “Start Camera” to scan a part label.</p>
                    <Button variant="primary" onClick={startCamera}>Start Camera</Button>
                  </>
                )}
                {scanState === 'starting' && <div className="scan-spinner" aria-label="Starting camera" />}
                {scanState === 'denied' && (
                  <>
                    <p className="scan-big">Camera access blocked</p>
                    <p className="scan-hint">
                      Allow camera permission in your browser and try again, or switch to
                      the Manual Entry tab / pick a part below to simulate a scan.
                    </p>
                    <Button onClick={startCamera}>Try Again</Button>
                  </>
                )}
                {scanState === 'unsupported' && (
                  <>
                    <p className="scan-big">Camera not available</p>
                    <p className="scan-hint">This device/browser does not expose a camera. Use Manual Entry or the sample codes below.</p>
                  </>
                )}
                {scanState === 'error' && (
                  <>
                    <p className="scan-big">Camera error</p>
                    <p className="scan-hint">{error || 'Could not start the camera.'}</p>
                    <Button onClick={startCamera}>Try Again</Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="scan-controls">
            {scanState === 'scanning'
              ? <Button variant="danger" onClick={() => { stopCamera(); setScanState('idle'); }}>■ Stop Camera</Button>
              : null}
            <Button onClick={toggleFlash} disabled={!flashTrackRef.current}>
              {flashOn ? 'Flash: On' : 'Flash: Off'}
            </Button>
            <span className="scan-status">
              {scanState === 'scanning' ? 'Looking for a QR code…' : 'Camera idle'}
            </span>
          </div>

          {lookup === 'found' && <div className="scan-result scan-ok">✓ QR recognised — opening part details…</div>}
          {lookup === 'notfound' && (
            <div className="scan-result scan-miss">
              ✕ Code <strong className="mono">{lastResolved}</strong> decoded, but no part in inventory matches it.
              <div className="scan-result-actions">
                <Button onClick={() => go('/add')}>+ Add New Part</Button>
                <Button onClick={() => go('/inventory')}>Search Inventory</Button>
              </div>
            </div>
          )}
          {lookup === 'invalid' && (
            <div className="scan-result scan-bad">
              ✕ <strong className="mono">{lastResolved || 'Empty code'}</strong> is not a valid part QR.
              Expected a code like <span className="mono">QR-48291</span> or a part number.
            </div>
          )}
        </section>
      )}

      {mode === 'manual' && (
        <section className="card scan-card">
          <h2 className="card-title">Enter QR / Part Number</h2>
          <div className="manual-row">
            <input
              className="search-input mono"
              placeholder="e.g. QR-48291 or BP-48291"
              value={manualCode}
              onChange={(e) => { setManualCode(e.target.value.toUpperCase()); setLookup(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
              autoFocus
            />
            <Button variant="primary" onClick={submitManual}>Look Up</Button>
          </div>
          {lookup === 'found' && <div className="scan-result scan-ok">✓ Match found — opening part details…</div>}
          {lookup === 'notfound' && (
            <div className="scan-result scan-miss">
              ✕ No part matches <strong className="mono">{lastResolved}</strong>.
              <div className="scan-result-actions">
                <Button onClick={() => go('/add')}>+ Add New Part</Button>
              </div>
            </div>
          )}
          {lookup === 'invalid' && (
            <div className="scan-result scan-bad">
              ✕ <strong className="mono">{lastResolved}</strong> doesn’t look like a valid QR or part number.
            </div>
          )}

          <h2 className="card-title" style={{ marginTop: 24 }}>Or pick a part to simulate a scan</h2>
          <PartSearchPicker onSelect={(p) => { setManualCode(p.qrCode); resolveCode(p.qrCode); }} />
        </section>
      )}

      <section className="card">
        <header className="card-head">
          <h2 className="card-title">Sample QR Codes</h2>
          <p className="card-desc">Simulate a scan by clicking a code (desktop demo shortcut)</p>
        </header>
        <div className="sample-grid">
          {sampleQrs.map((p) => (
            <button key={p.id} className="sample-qr" onClick={() => { setMode('manual'); setManualCode(p.qrCode); resolveCode(p.qrCode); }}>
              <QrImage value={p.qrCode} size={72} />
              <span className="mono">{p.qrCode}</span>
              <span className="sample-name">{p.partName}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
