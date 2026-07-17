"use strict";

const SMOOTH = 0.15;
const HISTORY = 90;

const entries = new Map();
let stack = [];
let enabled = false;
let frameStart = 0;
let frameTotalMs = 0;

function getEntry(name) {
  let e = entries.get(name);
  if (!e) {
    e = { avg: 0, peak: 0, history: new Float32Array(HISTORY), idx: 0, _t0: 0 };
    entries.set(name, e);
  }
  return e;
}

export function profilerEnabled() { return enabled; }

export function setProfilerEnabled(v) {
  enabled = !!v;
  if (v) {
    window._perf = { begin: beginSection, end: endSection, beginFrame, endFrame };
  } else {
    window._perf = null;
  }
}

function beginFrame() {
  frameStart = performance.now();
  stack.length = 0;
}

function endFrame() {
  frameTotalMs = performance.now() - frameStart;
}

export function profilerFrameMs() { return frameTotalMs; }

function beginSection(name) {
  const e = getEntry(name);
  e._t0 = performance.now();
  stack.push(name);
}

function endSection(name) {
  const e = entries.get(name);
  if (!e) return;
  const ms = performance.now() - e._t0;
  e.avg += (ms - e.avg) * SMOOTH;
  if (ms > e.peak) e.peak = ms;
  else e.peak *= 0.995;
  e.history[e.idx % HISTORY] = ms;
  e.idx++;
  if (stack.length && stack[stack.length - 1] === name) stack.pop();
}

export function profilerResults() {
  const out = [];
  for (const [name, e] of entries) {
    out.push({ name, avg: e.avg, peak: e.peak });
  }
  out.sort((a, b) => b.avg - a.avg);
  return out;
}

export function profilerReset() {
  entries.clear();
  stack.length = 0;
  frameTotalMs = 0;
  window._perf = null;
}
