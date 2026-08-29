import { useState, type ReactNode } from "react";
import { Clipboard, FileText, Folder, Image, Link2, Plus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ipc, isTauri } from "@/lib/ipc";
import { generateId } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";

interface AttachmentMenuProps {
  onAdd: (attachments: Attachment[]) => void;
  disabled?: boolean;
  trigger?: ReactNode;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const BINARY_EXTENSIONS =
  /^(png|jpe?g|gif|webp|bmp|ico|pdf|exe|dll|zip|gz|tar|mp4|mp3|wav|mov|bin|so|dylib)$/i;
const DIR_LISTING_CAP = 200;

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function imageMimeType(name: string): string {
  const ext = extensionOf(name);
  if (ext === "jpg") return "image/jpeg";
  return ext ? `image/${ext}` : "image/png";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(blob);
  });
}

export function getMaxPreviewBytes(): number {
  const mb = useSettingsStore.getState().settings.chat.maxPreviewSizeMb;
  return Math.max(1, Math.min(256, mb)) * 1_048_576;
}

export function checkPreviewSize(bytes: number, name: string): boolean {
  const max = getMaxPreviewBytes();
  if (bytes > max) {
    const maxMb = max / 1_048_576;
    const sizeMb = (bytes / 1_048_576).toFixed(1);
    toast.error(`${name} is ${sizeMb} MB, exceeding the ${maxMb} MB preview limit.`);
    return false;
  }
  return true;
}

/** Web fallback file picker built on a throwaway input element. */
function pickWebFiles(options: {
  multiple?: boolean;
  accept?: string;
  directory?: boolean;
}): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    if (options.multiple) input.multiple = true;
    if (options.accept) input.accept = options.accept;
    if (options.directory) input.setAttribute("webkitdirectory", "");
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : []);
      input.remove();
    };
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

function capListing(lines: string[]): string {
  const shown = lines.slice(0, DIR_LISTING_CAP);
  const extra = lines.length - shown.length;
  return extra > 0 ? [...shown, `… and ${extra} more`].join("\n") : shown.join("\n");
}

/** Attach flow for text/binary files. Reused by the composer mention menu. */
async function pickFileAttachments(): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ multiple: true });
    if (!selected) return attachments;
    for (const path of selected) {
      const name = basename(path);
      if (BINARY_EXTENSIONS.test(extensionOf(name))) {
        attachments.push({ id: generateId(), kind: "file", name, path });
        toast.info(`${name}: binary file attached without content.`);
        continue;
      }
      try {
        const textContent = await ipc.readFileText(path);
        attachments.push({
          id: generateId(),
          kind: "file",
          name,
          path,
          textContent,
          size: textContent.length,
        });
      } catch {
        attachments.push({ id: generateId(), kind: "file", name, path });
        toast.info(`${name}: binary file attached without content.`);
      }
    }
    return attachments;
  }
  const files = await pickWebFiles({ multiple: true });
  if (!files) return attachments;
  for (const file of files) {
    if (BINARY_EXTENSIONS.test(extensionOf(file.name))) {
      attachments.push({ id: generateId(), kind: "file", name: file.name, size: file.size });
      toast.info(`${file.name}: binary file attached without content.`);
      continue;
    }
    const textContent = await file.text();
    attachments.push({
      id: generateId(),
      kind: "file",
      name: file.name,
      textContent,
      size: textContent.length,
    });
  }
  return attachments;
}

/** Attach flow for images (base64 preview). Reused by the composer mention menu. */
async function pickImageAttachments(): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });
    if (!selected) return attachments;
    for (const path of selected) {
      const bytes = await readFile(path);
      const name = basename(path);
      if (!checkPreviewSize(bytes.length, name)) continue;
      const mimeType = imageMimeType(name);
      attachments.push({
        id: generateId(),
        kind: "image",
        name,
        path,
        mimeType,
        size: bytes.length,
        preview: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
      });
    }
    return attachments;
  }
  const files = await pickWebFiles({ multiple: true, accept: "image/*" });
  if (!files) return attachments;
  for (const file of files) {
    if (!checkPreviewSize(file.size, file.name)) continue;
    const preview = await readBlobAsDataUrl(file);
    attachments.push({
      id: generateId(),
      kind: "image",
      name: file.name,
      mimeType: file.type || imageMimeType(file.name),
      size: file.size,
      preview,
    });
  }
  return attachments;
}

async function pickFolderAttachment(): Promise<Attachment | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true });
    if (!selected) return null;
    const entries = await ipc.readDirEntries(selected);
    const lines = entries.map((entry) => (entry.isDir ? `${entry.name}/` : entry.name));
    const textContent = capListing(lines);
    return {
      id: generateId(),
      kind: "folder",
      name: basename(selected),
      path: selected,
      textContent,
      size: textContent.length,
    };
  }
  const files = await pickWebFiles({ directory: true });
  if (!files || files.length === 0) return null;
  const lines = files.map((file) => file.webkitRelativePath || file.name);
  const textContent = capListing(lines);
  return {
    id: generateId(),
    kind: "folder",
    name: lines[0].split("/")[0] || "folder",
    textContent,
    size: textContent.length,
  };
}

async function pasteImageAttachment(): Promise<Attachment | null> {
  if (isTauri) {
    try {
      const { readImage } = await import("@tauri-apps/plugin-clipboard-manager");
      const image = await readImage();
      const { width, height } = await image.size();
      const rgba = await image.rgba();
      const byteSize = width * height * 4;
      if (!checkPreviewSize(byteSize, "clipboard-image.png")) return null;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
      return {
        id: generateId(),
        kind: "image",
        name: "clipboard-image.png",
        mimeType: "image/png",
        preview: canvas.toDataURL("image/png"),
      };
    } catch {
      toast.info("No image on clipboard");
      return null;
    }
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      if (!checkPreviewSize(blob.size, "clipboard-image.png")) return null;
      const preview = await readBlobAsDataUrl(blob);
      return {
        id: generateId(),
        kind: "image",
        name: "clipboard-image.png",
        mimeType: type,
        size: blob.size,
        preview,
      };
    }
    toast.info("No image on clipboard");
    return null;
  } catch {
    toast.info("No image on clipboard");
    return null;
  }
}

/** URL attach flow (title fetched best-effort). Reused by the composer mention menu. */
async function fetchUrlAttachment(rawUrl: string): Promise<Attachment | null> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    toast.error("Enter a valid URL, e.g. https://example.com");
    return null;
  }
  let title = url.hostname;
  try {
    const fetchFn = isTauri
      ? ((await import("@tauri-apps/plugin-http")).fetch as unknown as typeof window.fetch)
      : window.fetch.bind(window);
    const response = await fetchFn(url.toString(), { method: "GET" });
    const html = await response.text();
    const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    if (match?.[1]) title = match[1].trim();
  } catch {
    // Network/CORS failure — keep the hostname as the title.
  }
  return {
    id: generateId(),
    kind: "url",
    url: url.toString(),
    name: title,
    textContent: `${title}\n${url.toString()}`,
  };
}

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}

function MenuItem({ icon: Icon, label, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-standard hover:bg-accent"
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {label}
    </button>
  );
}

export function AttachmentMenu({ onAdd, disabled, trigger }: AttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setUrlMode(false);
    setUrl("");
  };

  const run = async (task: () => Promise<Attachment[] | Attachment | null>) => {
    setBusy(true);
    try {
      const result = await task();
      const list = Array.isArray(result) ? result : result ? [result] : [];
      if (list.length > 0) onAdd(list);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Attach"
            disabled={disabled}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-1">
        {urlMode ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => fetchUrlAttachment(url));
            }}
          >
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              aria-label="URL to attach"
              className="h-8 text-xs"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={busy || !url.trim()}>
              Add
            </Button>
          </form>
        ) : (
          <div role="menu" aria-label="Attachment options">
            <MenuItem
              icon={FileText}
              label="Attach File"
              onSelect={() => void run(pickFileAttachments)}
            />
            <MenuItem
              icon={Folder}
              label="Attach Folder"
              onSelect={() => void run(pickFolderAttachment)}
            />
            <MenuItem
              icon={Image}
              label="Attach Image"
              onSelect={() => void run(pickImageAttachments)}
            />
            <MenuItem
              icon={Clipboard}
              label="Paste Image"
              onSelect={() => void run(pasteImageAttachment)}
            />
            <MenuItem icon={Link2} label="Attach URL" onSelect={() => setUrlMode(true)} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

AttachmentMenu.pickFileAttachments = pickFileAttachments;
AttachmentMenu.pickImageAttachments = pickImageAttachments;
AttachmentMenu.pickFolderAttachment = pickFolderAttachment;
AttachmentMenu.fetchUrlAttachment = fetchUrlAttachment;
