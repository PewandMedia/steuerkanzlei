import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches a file from a private Supabase storage bucket and returns a local blob: URL.
 * Using a blob URL avoids browser popup blockers and makes the `download` attribute
 * work reliably (same-origin).
 */
async function fetchAsBlobUrl(bucket: string, pfad: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pfad, 60);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Signed URL konnte nicht erstellt werden");
  }
  const res = await fetch(data.signedUrl);
  if (!res.ok) {
    throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  // Force PDF mime type so browsers render inline when opened
  const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
  return URL.createObjectURL(pdfBlob);
}

/**
 * Triggers a reliable download of a PDF stored in a private Supabase bucket.
 * Bypasses popup blockers by using a blob: URL with a synthetic <a download> click.
 */
export async function downloadFromStorage(bucket: string, pfad: string, dateiname: string): Promise<void> {
  const blobUrl = await fetchAsBlobUrl(bucket, pfad);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = dateiname.endsWith(".pdf") ? dateiname : `${dateiname}.pdf`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Allow the browser a tick to start the download before revoking
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  }
}

/**
 * Opens a PDF in a new browser tab using a blob: URL.
 * Must be called synchronously from a user click — otherwise popup blockers may interfere.
 * Falls back to navigating the current tab if window.open is blocked.
 */
export async function openFromStorage(bucket: string, pfad: string): Promise<void> {
  // Open the tab immediately (synchronous to user click) so popup blockers allow it.
  const newTab = window.open("about:blank", "_blank");
  try {
    const blobUrl = await fetchAsBlobUrl(bucket, pfad);
    if (newTab && !newTab.closed) {
      newTab.location.href = blobUrl;
    } else {
      // Popup blocked → fall back to same tab
      window.location.assign(blobUrl);
    }
    // Revoke later to make sure the new tab finished loading the blob
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (err) {
    if (newTab && !newTab.closed) newTab.close();
    throw err;
  }
}
