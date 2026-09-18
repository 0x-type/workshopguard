import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkshopGuard — Customer Communication Assistant",
    short_name: "WorkshopGuard",
    description: "Conflict-aware customer communication for vehicle workshops.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#ffffff",
  };
}
