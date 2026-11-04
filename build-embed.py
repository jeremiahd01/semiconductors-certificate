#!/usr/bin/env python3
"""Split index.html into the three pieces the Wrap09 page template block needs.

index.html stays the source of truth: it is what runs standalone, what the
converter's instructions point at, and what gets edited. This regenerates
embed/ from it. Run it after any change to index.html and upload whichever
pieces changed.

    python3 build-embed.py            write embed/
    python3 build-embed.py --check    exit 1 if embed/ is out of date
"""
import io, os, re, sys, difflib

SRC, OUT = 'index.html', 'embed'
BANNER = ('GENERATED FROM index.html BY build-embed.py — DO NOT EDIT BY HAND.\n'
          'Edit index.html, re-run the script, re-upload what changed.')

def build():
    h = io.open(SRC, encoding='utf-8').read()

    css = re.search(r'<style[^>]*>(.*?)</style>', h, re.S).group(1)
    b = h.find('<body>') + len('<body>')
    s = h.find('<script>', b)
    markup = h[b:s].strip()
    js = h[s + len('<script>'):h.rfind('</script>')].strip()

    # the block owns the root element, so the data- attribute that points at the
    # published catalog is set here rather than buried in the script
    markup = markup.replace(
        '<div id="sc-app">',
        '<div id="sc-app"\n     data-catalog-url="@@CATALOG_URL@@">', 1)

    block = (
        '<!-- Semiconductors & Microelectronics Certificate builder.\n'
        '     %s\n\n'
        '     Set data-catalog-url below to the published path of course-data.json,\n'
        '     starting with "/" so it does not depend on this page\'s url.\n'
        '-->\n'
        '<link rel="stylesheet" href="@@BASE@@/semi-cert.css">\n\n'
        '%s\n\n'
        '<script src="@@BASE@@/semi-cert.js" defer></script>\n'
    ) % (BANNER.replace('\n', '\n     '), markup)

    return {
        'semi-cert.css': '/* %s */\n%s' % (BANNER.replace('\n', ' '), css),
        'semi-cert.js':  '/* %s */\n%s' % (BANNER.replace('\n', ' '), js),
        'block.html':    block,
    }

def main():
    files = build()
    check = '--check' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    stale = []
    for name, body in files.items():
        path = os.path.join(OUT, name)
        old = io.open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if old == body:
            print('  = %-16s %7d bytes' % (name, len(body)))
            continue
        stale.append(name)
        if check:
            print('  ! %-16s OUT OF DATE' % name)
            if old is not None:
                for line in list(difflib.unified_diff(
                        old.splitlines(), body.splitlines(), lineterm='', n=0))[2:8]:
                    print('      ' + line)
            continue
        io.open(path, 'w', encoding='utf-8').write(body)
        print('  %s %-16s %7d bytes' % ('+' if old is None else '~', name, len(body)))
    if check and stale:
        print('\nembed/ is stale — run: python3 build-embed.py')
        return 1
    if not check:
        print('\nPlaceholders left for the deployer:')
        print('  @@BASE@@         folder holding semi-cert.css / semi-cert.js')
        print('  @@CATALOG_URL@@  published path of course-data.json')
    return 0

if __name__ == '__main__':
    sys.exit(main())
