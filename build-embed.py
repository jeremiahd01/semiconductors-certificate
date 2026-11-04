#!/usr/bin/env python3
"""Split index.html into the three pieces the Wrap09 page template block needs.

ptCertificateTool.html is uploaded to the ZMI as a Page Template object, which
parses its body -- so it is kept XML-well-formed: void elements self-close and
entities are numeric. It must also stay free of ${...}, which a template engine
would read as its own interpolation syntax; that is why the script lives in its
own file rather than inline.

index.html stays the source of truth: it is what runs standalone, what the
converter's instructions point at, and what gets edited. This regenerates
certificate-tool/ from it. Run it after any change to index.html and upload whichever
pieces changed.

    python3 build-embed.py              write certificate-tool/
    python3 build-embed.py --base x/y   point the asset urls at folder x/y
    python3 build-embed.py --check      exit 1 if certificate-tool/ is out of date

--base is the folder holding semi-cert.css and semi-cert.js, as the rendered page
should ask for it. It defaults to "certificate-tool", relative, which is correct whenever
that folder sits beside the page the block renders on -- and keeps working if the pair is
moved elsewhere together. Give it a path starting with "/" to pin it absolutely.
"""
import io, os, re, sys, difflib

SRC, OUT = 'index.html', 'certificate-tool'
# The ZMI folder these are uploaded into. The generated page template asks for its
# assets at this path, relative to the page the block renders on, so the local
# folder name and the server folder name are deliberately the same.
DEFAULT_BASE = 'certificate-tool'
BANNER = ('GENERATED FROM index.html BY build-embed.py — DO NOT EDIT BY HAND.\n'
          'Edit index.html, re-run the script, re-upload what changed.')

def build(base=DEFAULT_BASE):
    h = io.open(SRC, encoding='utf-8').read()
    base = base.rstrip('/')

    css = re.search(r'<style[^>]*>(.*?)</style>', h, re.S).group(1)
    b = h.find('<body>') + len('<body>')
    s = h.find('<script>', b)
    markup = h[b:s].strip()
    js = h[s + len('<script>'):h.rfind('</script>')].strip()

    block = (
        '<!-- Semiconductors and Microelectronics Certificate builder.\n'
        '     %s\n\n'
        '     Assets are loaded from "%s/", relative to the page this renders on.\n'
        '     course-data.json is not named here: semi-cert.js looks for it beside\n'
        '     itself, so it follows the folder wherever it moves.\n'
        '-->\n'
        '<link rel="stylesheet" href="%s/semi-cert.css" />\n\n'
        '%s\n\n'
        '<script src="%s/semi-cert.js" defer="defer"></script>\n'
    ) % (BANNER.replace('\n', '\n     '), base, base, markup, base)

    return {
        'semi-cert.css': '/* %s */\n%s' % (BANNER.replace('\n', ' '), css),
        'semi-cert.js':  '/* %s */\n%s' % (BANNER.replace('\n', ' '), js),
        'ptCertificateTool.html': block,
    }

def main():
    base = DEFAULT_BASE
    if '--base' in sys.argv:
        i = sys.argv.index('--base')
        if i + 1 >= len(sys.argv):
            print('--base needs a value, e.g. --base certificate-tool'); return 2
        base = sys.argv[i + 1]
    files = build(base)
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
        print('\ncertificate-tool/ is stale — run: python3 build-embed.py')
        return 1
    if not check:
        print('\nAssets referenced as: %s/semi-cert.{css,js}' % base)
        print('course-data.json is found by the script, beside itself — nothing to set.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
