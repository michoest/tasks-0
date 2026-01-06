import session from 'express-session';

export class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, callback) {
    try {
      const now = Date.now();
      const row = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?').get(sid, now);

      if (row) {
        callback(null, JSON.parse(row.sess));
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      const expire = session.cookie && session.cookie.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (24 * 60 * 60 * 1000); // 24 hours default

      const sess = JSON.stringify(session);

      this.db.prepare(`
        INSERT INTO sessions (sid, expire, sess)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET expire = ?, sess = ?
      `).run(sid, expire, sess, expire, sess);

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, session, callback) {
    try {
      const expire = session.cookie && session.cookie.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (24 * 60 * 60 * 1000);

      this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire, sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}
