import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Decimal } from "@prisma/client/runtime/library";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number | Decimal): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

export function generateInvoiceNumber(lastNumber?: string): string {
  const currentYear = new Date().getFullYear();

  if (!lastNumber) {
    return `${currentYear}-001`;
  }

  const parts = lastNumber.split("-");
  if (parts.length !== 2) {
    return `${currentYear}-001`;
  }

  const [yearPart, sequencePart] = parts;
  const year = parseInt(yearPart, 10);
  const sequence = parseInt(sequencePart, 10);

  if (isNaN(year) || isNaN(sequence)) {
    return `${currentYear}-001`;
  }

  if (year < currentYear) {
    // New year, reset sequence
    return `${currentYear}-001`;
  }

  const nextSequence = sequence + 1;
  return `${currentYear}-${String(nextSequence).padStart(3, "0")}`;
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const firstTwo = words.slice(0, 2);
  return firstTwo.map((word) => word.charAt(0).toUpperCase()).join("");
}
