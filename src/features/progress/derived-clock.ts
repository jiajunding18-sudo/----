"use client";
import { useSyncExternalStore } from "react";
let value=new Date().toISOString();
const listeners=new Set<()=>void>();
let timer:ReturnType<typeof setInterval>|undefined;
const refresh=()=>{if(document.visibilityState==='visible') refreshDerivedClock();};
export function refreshDerivedClock(){value=new Date().toISOString();listeners.forEach(fn=>fn());}
function subscribe(fn:()=>void){
  listeners.add(fn);
  if(listeners.size===1) {
    timer=setInterval(refresh,60000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  }
  refresh();
  return ()=>{listeners.delete(fn);if(!listeners.size){clearInterval(timer);timer=undefined;window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);}};
}
export function useDerivedClock(){return useSyncExternalStore(subscribe,()=>value,()=>"1970-01-01T00:00:00.000Z");}
