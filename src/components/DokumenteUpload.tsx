import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Upload, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_BELEG_ACCEPT, getMimeFromName, validateBelegFile } from "@/lib/file-types";

interface Props {
  buchhaltungId: string;
  onUploaded: () => void;
}

const MAX_SIZE = 20 * 1024 * 1024;

export function DokumenteUpload({ buchhaltungId, onUploaded }: Props) {
  const { benutzerId } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => validateBelegFile(file, MAX_SIZE);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const errors: string[] = [];
    const valid: File[] = [];
    arr.forEach((f) => {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    });
    if (errors.length) {
      toast({ title: "Ungültige Dateien", description: errors.join("\n"), variant: "destructive" });
    }
    if (valid.length) setFiles((prev) => [...prev, ...valid]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !benutzerId) return;
    setUploading(true);
    const total = files.length;
    let uploaded = 0;

    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${buchhaltungId}/${timestamp}_${safeName}`;

      setProgress(Math.round((uploaded / total) * 90));

      const { error: storageError } = await supabase.storage
        .from("belege")
        .upload(path, file, { contentType: file.type || getMimeFromName(file.name) });

      if (storageError) {
        toast({ title: "Upload-Fehler", description: `${file.name}: ${storageError.message}`, variant: "destructive" });
        continue;
      }

      await supabase.from("buchhaltung_dokumente").insert({
        buchhaltung_id: buchhaltungId,
        dateiname: file.name,
        dateipfad: path,
        hochgeladen_von: benutzerId,
      });

      uploaded++;
    }

    setProgress(100);
    toast({ title: `${uploaded} Beleg(e) hochgeladen` });

    // Notify Sachbearbeiter when documents are uploaded after initial intake (Nachreichen)
    if (uploaded > 0) {
      try {
        const { data: bh } = await supabase
          .from("buchhaltungen")
          .select("status, monat, bearbeiter_id, mandant:mandanten(name, firma)")
          .eq("id", buchhaltungId)
          .maybeSingle();
        if (bh && bh.status !== "Eingegangen" && bh.bearbeiter_id) {
          const mandantName = (bh.mandant as any)?.firma || (bh.mandant as any)?.name || "Mandant";
          await supabase.from("benachrichtigungen").insert({
            empfaenger_id: bh.bearbeiter_id,
            typ: "beleg_nachgereicht",
            titel: "Neuer Beleg nachgereicht",
            nachricht: `${uploaded} neue${uploaded === 1 ? "r" : ""} Beleg${uploaded === 1 ? "" : "e"} für ${mandantName} (${bh.monat}) wurden nachgereicht.`,
            buchhaltung_id: buchhaltungId,
          });
        }
      } catch {
        // non-blocking
      }
    }

    setFiles([]);
    setUploading(false);
    setProgress(0);
    onUploaded();
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_BELEG_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">PDFs oder Fotos hier ablegen oder klicken</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG · Mehrere Dateien · Max. 20 MB · WhatsApp-Fotos einfach speichern und hochladen</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-muted rounded-lg">
              <FileUp className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(i)} disabled={uploading}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {uploading && <Progress value={progress} className="h-2" />}

      {files.length > 0 && !uploading && (
        <Button onClick={handleUpload} className="w-full">
          <Upload className="h-4 w-4 mr-2" /> {files.length} Beleg{files.length !== 1 ? "e" : ""} hochladen
        </Button>
      )}
    </div>
  );
}
