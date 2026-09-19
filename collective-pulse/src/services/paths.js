export function appPath(pathname, base = "/") {
  const prefix = base.endsWith("/") ? base : base + "/";
  const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1);
  return "/" + relative.replace(/\/$/, "");
}

export function assetUrl(name) {
  return (import.meta.env?.BASE_URL || "/") + "assets/" + name;
}

export function soundUrl(name) {
  return (import.meta.env?.BASE_URL || "/") + "sounds/" + name;
}
