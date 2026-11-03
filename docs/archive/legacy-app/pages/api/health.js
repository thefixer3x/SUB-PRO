export default function handler(request, response) {
  response.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'SubTrack Pro API is running'
  });
}
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="fefcc218-bec8-53d6-bf4e-71b5203326d0")}catch(e){}}();
//# debugId=fefcc218-bec8-53d6-bf4e-71b5203326d0
