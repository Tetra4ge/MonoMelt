/**
 * Safety checks for archive entries, shared by the ingestion worker and its tests.
 * Nothing is ever extracted to disk, but entry names still end up in storage paths
 * and the manifest, so hostile names and links are rejected up front.
 */

/** Unix mode bits live in the upper 16 bits of the ZIP external attributes. */
const isSymlink = (entry) => (((entry.header.attr >>> 16) & 0xF000) === 0xA000);

const normaliseEntryPath = (entryName) => entryName.replace(/\\/g, '/').replace(/^\/+/, '');

/** True for directories, links, empty names, `..` traversal and Windows drive paths. */
const shouldSkipEntry = (entry, filePath) =>
  entry.isDirectory ||
  !filePath ||
  filePath.split('/').some((segment) => segment === '..') ||
  /^[A-Za-z]:/.test(filePath) ||
  isSymlink(entry);

module.exports = { isSymlink, normaliseEntryPath, shouldSkipEntry };
