import { patchFetch, patchXHR } from "./intercept";
import { createWidget } from "./ui";

patchFetch();
patchXHR();
createWidget();
