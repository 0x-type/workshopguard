import Image from "next/image";
import Link from "next/link";

/**
 * The dealership's mark, always accompanied by the words "unofficial prototype".
 *
 * The logo belongs to a real business. Nothing here may read as though the
 * dealership is running it, so the disclaimer travels with the mark rather than
 * being tucked away on one page.
 */
export function Brand({
  name,
  productName,
  logo,
  size = "sm",
  href = "/",
}: {
  name: string;
  productName: string;
  logo: string;
  size?: "sm" | "lg";
  href?: string | null;
}) {
  const height = size === "lg" ? 44 : 28;

  const mark = (
    <span className="flex items-center gap-2.5 min-w-0">
      <Image
        src={logo}
        alt={`${name} logo`}
        width={Math.round((299 / 168) * height)}
        height={height}
        priority
        style={{
          borderRadius: size === "lg" ? 10 : 7,
          border: "1px solid var(--border)",
          background: "#fff",
          objectFit: "contain",
          flex: "none",
        }}
      />
      <span className="min-w-0 leading-tight">
        <span
          className={`block font-semibold truncate ${size === "lg" ? "text-lg" : "text-sm"}`}
          style={{ color: "var(--text)" }}
        >
          {name}
        </span>
        <span className={`block muted truncate ${size === "lg" ? "text-sm" : "text-xs"}`}>
          {productName}
        </span>
      </span>
    </span>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: "none" }}>
      {mark}
    </Link>
  ) : (
    mark
  );
}
