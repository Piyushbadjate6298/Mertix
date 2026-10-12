const BASE=import.meta.env.VITE_API_URL||'http://localhost:4000/api';
export async function api(path,{method='GET',body,token}={}){let response;try{response=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}catch{throw new Error('Unable to connect to API. Start the backend with npm start in the backend folder.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;}
export const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
export const friendlyDate=d=>new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
