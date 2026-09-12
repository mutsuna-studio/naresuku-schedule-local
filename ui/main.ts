import {mount,unmount} from 'svelte';
import App from './App.svelte';
import './style.css';
import './admin-theme.css';
import './master-login.css';
export function start(target:HTMLElement,onReady?:()=>void,initialSchedule?:Promise<Response|null>){const app=mount(App,{target,props:{onReady,initialSchedule}});return ()=>unmount(app);}
