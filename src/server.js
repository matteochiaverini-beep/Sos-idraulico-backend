import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { pool, ensureSchema } from './db.js';
import { uploadMedia, getMediaUrl } from './storage.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

const URGENZE_VALIDE = new Set([1, 2, 3]);
const STATI_VALIDI   = new Set(['in_attesa', 'assegnata', 'in_corso', 'risolta']);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/richieste', upload.array('media', 10), async (req, res) => {
  try {
    const {
      tipo_problema, urgenza, descrizione = '',
      piano = '', accesso = '[]',
      nome, telefono, email = '', indirizzo,
    } = req.body;

    if (!tipo_problema || !nome || !telefono || !indirizzo) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }
    const urg = Number(urgenza);
    if (!URGENZE_VALIDE.has(urg)) {
      return res.status(400).json({ error: 'Urgenza non valida' });
    }

    let accessoArr = [];
    try { accessoArr = JSON.parse(accesso); } catch {}
    if (!Array.isArray(accessoArr)) accessoArr = [];

    const mediaUrls = [];
    for (const f of (req.files || [])) {
      const key = await uploadMedia(f);
      mediaUrls.push(key);
    }

    const { rows } = await pool.query(
      `INSERT INTO richieste
         (tipo_problema, urgenza, descrizione, media_urls, piano, accesso,
          nome, telefono, email, indirizzo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, stato, creato_il`,
      [tipo_problema, urg, descrizione, mediaUrls, piano, accessoArr,
       nome, telefono, email, indirizzo]
    );

    res.status(201).json({
      id: rows[0].id,
      stato: rows[0].stato,
      creato_il: rows[0].creato_il,
      media_urls: mediaUrls,
    });
  } catch (err) {
    console.error('[POST /richieste]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

app.get('/richieste', async (req, res) => {
  try {
    const { stato } = req.query;
    const params = [];
    let where = '';
    if (stato) {
      if (!STATI_VALIDI.has(stato)) return res.status(400).json({ error: 'Stato non valido' });
      params.push(stato);
      where = 'WHERE stato = $1';
    }
    const { rows } = await pool.query(
      `SELECT id, tipo_problema, urgenza, descrizione, media_urls, piano,
              accesso, nome, telefono, email, indirizzo, stato, creato_il
         FROM richieste
         ${where}
         ORDER BY urgenza DESC, creato_il DESC`,
      params
    );
    const rowsConUrl = await Promise.all(rows.map(async r => ({
      ...r,
      media_urls: await Promise.all((r.media_urls || []).map(getMediaUrl)),
    })));
    res.json(rowsConUrl);
  } catch (err) {
    console.error('[GET /richieste]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

app.patch('/richieste/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { stato } = req.body;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id non valido' });
    if (!STATI_VALIDI.has(stato)) return res.status(400).json({ error: 'Stato non valido' });

    const { rows } = await pool.query(
      `UPDATE richieste SET stato = $1 WHERE id = $2 RETURNING id, stato`,
      [stato, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /richieste/:id]', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

const PORT = process.env.PORT || 3000;
ensureSchema()
  .then(() => app.listen(PORT, () => console.log(`SOS Idraulico backend su :${PORT}`)))
  .catch(err => { console.error('Schema init fallito', err); process.exit(1); });