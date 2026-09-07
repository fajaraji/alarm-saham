// Setup proyek "ui" (jsdom): matcher jest-dom + bersihkan DOM tiap tes.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
