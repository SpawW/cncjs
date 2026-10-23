// Holds the last SVG/STL import in memory so the Run dialog can regenerate
// the G-code with another profile without asking the user to pick the file
// again. It is intentionally not persisted: the source can be large and this
// only needs to survive while the page is open.
let lastImport = null;

export const setLastImport = (payload) => {
  lastImport = payload || null;
};

export const getLastImport = () => lastImport;
