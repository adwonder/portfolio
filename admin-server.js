const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3001;
const ROOT = __dirname;
const DEPLOY_ROOT = path.join(__dirname, '..', 'portfolio-deploy');

// Copy a text file to portfolio-deploy
function syncTextToDeploy(filePath, content) {
    const dest = path.join(DEPLOY_ROOT, filePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf-8');
}

// Copy a binary file to portfolio-deploy
function syncBinaryToDeploy(filePath) {
    const src = path.join(ROOT, filePath);
    const dest = path.join(DEPLOY_ROOT, filePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

// Git commit + push from portfolio-deploy
function gitPush(message) {
    try {
        execSync(`git -C "${DEPLOY_ROOT}" add -A`);
        const status = execSync(`git -C "${DEPLOY_ROOT}" status --porcelain`).toString().trim();
        if (!status) return { ok: true, pushed: false };
        execSync(`git -C "${DEPLOY_ROOT}" commit -m "${message}"`);
        execSync(`git -C "${DEPLOY_ROOT}" push`);
        return { ok: true, pushed: true };
    } catch (e) {
        console.error('Git error:', e.message);
        return { ok: false, error: e.message };
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Save text files (projects.js, config.js, etc.)
    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { files } = JSON.parse(body);
                for (const { path: filePath, content } of files) {
                    // Save to portfolio/
                    const full = path.join(ROOT, filePath);
                    fs.mkdirSync(path.dirname(full), { recursive: true });
                    fs.writeFileSync(full, content, 'utf-8');
                    // Sync to portfolio-deploy/
                    syncTextToDeploy(filePath, content);
                }
                // Push to GitHub
                const gitResult = gitPush('Admin: update content');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, git: gitResult }));
            } catch (e) {
                console.error('Save error:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Upload binary files (images, videos)
    if (req.method === 'POST' && req.url === '/upload') {
        const filePath = req.headers['x-filename'];
        if (!filePath) {
            res.writeHead(400);
            res.end('Missing X-Filename header');
            return;
        }
        const full = path.join(ROOT, filePath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        const stream = fs.createWriteStream(full);
        req.pipe(stream);
        stream.on('finish', () => {
            try {
                // Sync binary file to portfolio-deploy/
                syncBinaryToDeploy(filePath);
                // Push to GitHub
                const gitResult = gitPush(`Admin: upload ${path.basename(filePath)}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, git: gitResult }));
            } catch (e) {
                console.error('Upload sync error:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        stream.on('error', (e) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`Admin save server running at http://localhost:${PORT}`);
    console.log(`Syncing to: ${DEPLOY_ROOT}`);
});
