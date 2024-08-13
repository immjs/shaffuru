import { readConfig } from './config.js';
import { Musician } from './musician.js';

const config = await readConfig();

new Musician(config);
