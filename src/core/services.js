const registry = Object.create(null);

export function provide(name, value) {
  registry[name] = value;
}

export function inject(name) {
  return registry[name];
}
