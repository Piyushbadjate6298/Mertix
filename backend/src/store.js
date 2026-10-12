import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {initialUsers,exams} from './data.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');fs.mkdirSync(root,{recursive:true});const file=path.join(root,'store.json');
export const hash=p=>crypto.scryptSync(String(p),'lgw-meritx-demo',64).toString('hex');
const fresh=()=>({users:initialUsers.map(({password,...u})=>({...u,passwordHash:hash(password)})),registrations:[],attempts:[],tickets:[],papers:[],audit:[],payments:[],rewards:[],examOverrides:{}});
let db;try{db=JSON.parse(fs.readFileSync(file,'utf8'));}catch{db=fresh();fs.writeFileSync(file,JSON.stringify(db,null,2));}
export const store=()=>db;export const save=()=>fs.writeFileSync(file,JSON.stringify(db,null,2));export const uid=prefix=>prefix+'-'+crypto.randomUUID().slice(0,12);
export const publicUser=({passwordHash,...safe})=>safe;
export const examList=()=>exams.map(e=>({...e,...db.examOverrides[e.id]}));
