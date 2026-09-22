# Adding your photos

Drop image files straight into the matching folder — no other setup:

```
photos/travel/
photos/personal/
photos/bruin/       (Daily Bruin)
```

Then, from the project root, run:

```
node build-photos.mjs
```

Refresh the site. That category now shows your real photos instead of the
gray placeholders — the other categories are untouched until you add photos
to their folders too and run the script again.

## Mini-galleries (a card with more than one photo)

A loose file is a single-photo card. Put photos in a **subfolder** instead,
and the whole subfolder becomes one card — clicking it opens a lightbox you
scroll through all of that subfolder's photos, same as the placeholder cards
that already show a little count badge.

```
photos/travel/
  01-golden-gate-bridge.jpg     <- single-photo card
  02-market-day/                <- one card, a mini-gallery of 3
    1.jpg
    2.jpg
    3.jpg
  03-sunset.jpg                 <- single-photo card
```

The folder's name becomes that card's title (so "02-market-day" → "Market
Day") — the filenames *inside* it don't matter and won't show up anywhere,
so name them however's convenient (`1.jpg`, `2.jpg`, ... is fine). The order
they scroll in in the lightbox follows their alphabetical order inside the
folder, same numbering trick as everywhere else in here.

## Formats

**JPG/JPEG and PNG only.** If your photos are HEIC (the default on iPhone),
convert them first — on a Mac, select them in Finder, open with Preview,
then File → Export, or use any online HEIC → JPG converter. The script
skips anything else and tells you what it skipped.

## Ordering and titles

Files and subfolders are read together in one alphabetical order, so prefix
either with numbers to control where it lands relative to the other —
`01-golden-gate-bridge.jpg`, `02-market-day/`, `03-sunset.jpg` appear in
exactly that order.

The title shown in the lightbox comes from the file's (or folder's) name:
the leading number is stripped, dashes/underscores become spaces, and it's
title-cased — `01-golden-gate-bridge.jpg` becomes "Golden Gate Bridge".
Rename the file or folder to change the title.

## Re-running

Safe to re-run `node build-photos.mjs` any time — add a few more photos,
run it again, refresh. It only reads your folders and rewrites
`photos-data.js`; it never touches or deletes your original images.

## Going back to placeholders

Delete a category's photos (or the whole `photos-data.js` file) and
re-run the script — an empty category automatically falls back to the
placeholder gallery, same as before any of this existed.
