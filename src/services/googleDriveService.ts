import { Incident } from '../types';

export interface DriveUploadedFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
}

const PRL_FOLDER_NAME = 'PrevRiesgos PRL - Informes y Planes de Accion';

/**
 * Searches for existing PRL folder or creates a new one in Google Drive
 */
export async function getOrCreatePRLFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(`name = '${PRL_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    throw new Error('Error al consultar carpetas en Google Drive');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: PRL_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    throw new Error('No se pudo crear la carpeta PRL en Google Drive');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * Converts a base64 Data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const mimeType = dataUrl.split(';')[0]?.replace('data:', '') || 'image/jpeg';
  const base64Data = dataUrl.split(',')[1] || dataUrl;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

/**
 * Uploads an image photo directly to Google Drive
 */
export async function uploadPhotoToDrive(
  accessToken: string,
  fileName: string,
  photoDataUrl: string,
  folderId: string
): Promise<DriveUploadedFile> {
  const { blob, mimeType } = dataUrlToBlob(photoDataUrl);

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al subir fotografía a Google Drive: ${errText}`);
  }

  return await res.json();
}

/**
 * Uploads an incident report and action plan file to Google Drive
 */
export async function saveIncidentToDrive(
  accessToken: string,
  incident: Incident,
  folderId?: string
): Promise<{ reportFile: DriveUploadedFile; photoFile?: DriveUploadedFile }> {
  const targetFolderId = folderId || (await getOrCreatePRLFolder(accessToken));

  // If incident has photo evidence as base64, upload photo first
  let photoFile: DriveUploadedFile | undefined;
  if (incident.photoUrl && incident.photoUrl.startsWith('data:image/')) {
    try {
      const photoName = `Evidencia_Fotografica_${incident.code}.jpg`;
      photoFile = await uploadPhotoToDrive(accessToken, photoName, incident.photoUrl, targetFolderId);
    } catch (photoErr) {
      console.warn('No se pudo subir la foto individual a Drive:', photoErr);
    }
  }

  const fileName = `Informe_${incident.code}_${incident.title.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  
  const content = JSON.stringify(
    {
      sistema: 'PrevRiesgos PRL · Gestión y Registro en Tiempo Real',
      cuentaPrevencionista: 'prevred3@gmail.com',
      codigoIncidente: incident.code,
      fechaHoraRegistro: incident.timestamp,
      titulo: incident.title,
      clasificacion: incident.type,
      severidad: incident.severity,
      ubicacion: incident.location,
      estadoActual: incident.status,
      reportadoPor: incident.reporterName,
      rolReportante: incident.reporterRole,
      trabajadorAfectado: incident.affectedPerson || 'Sin lesionados',
      descripcionHechos: incident.description,
      medidaContencionInmediata: incident.immediateAction,
      investigacion5Porques: incident.rootCauseAnalysis,
      planDeAccionCorrectivoCAPA: incident.correctiveActions,
      fotoEvidenciaAdjunta: incident.photoUrl ? 'Registrada en sistema' : 'Sin fotografía',
      enlaceFotoEnDrive: photoFile?.webViewLink || 'N/A',
      exportadoEl: new Date().toISOString()
    },
    null,
    2
  );

  const metadata = {
    name: fileName,
    parents: [targetFolderId],
    mimeType: 'application/json'
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([content], { type: 'application/json' }));

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: form
    }
  );

  if (!uploadRes.ok) {
    const errorBody = await uploadRes.text();
    throw new Error(`Error al subir a Google Drive: ${errorBody}`);
  }

  const reportFile: DriveUploadedFile = await uploadRes.json();
  return { reportFile, photoFile };
}

/**
 * Uploads a master summary of all incidents and open CAPA actions
 */
export async function uploadMasterSummaryToDrive(
  accessToken: string,
  incidents: Incident[]
): Promise<DriveUploadedFile> {
  const targetFolderId = await getOrCreatePRLFolder(accessToken);
  const fileName = `Master_Registro_PRL_Seguimiento_${new Date().toISOString().slice(0, 10)}.json`;

  const payload = {
    sistema: 'PrevRiesgos PRL - Centro de Comando Matriz',
    supervisadoPorPrevencionista: 'prevred3@gmail.com',
    fechaSincronizacion: new Date().toISOString(),
    totalIncidentes: incidents.length,
    abiertos: incidents.filter((i) => i.status === 'Abierto').length,
    enInvestigacion: incidents.filter((i) => i.status === 'En Investigación').length,
    enAccion: incidents.filter((i) => i.status === 'Acción en Curso').length,
    cerrados: incidents.filter((i) => i.status === 'Cerrado').length,
    incidentes: incidents.map((i) => ({
      code: i.code,
      fecha: i.timestamp,
      titulo: i.title,
      tipo: i.type,
      severidad: i.severity,
      ubicacion: i.location,
      estado: i.status,
      reportante: i.reporterName,
      tieneFoto: Boolean(i.photoUrl),
      accionesPendientes: i.correctiveActions.filter((a) => !a.completed).length,
      planDeAccion: i.correctiveActions
    }))
  };

  const metadata = {
    name: fileName,
    parents: [targetFolderId],
    mimeType: 'application/json'
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: form
    }
  );

  if (!uploadRes.ok) {
    throw new Error('Fallo al exportar registro maestro a Google Drive');
  }

  return await uploadRes.json();
}

/**
 * Lists files created in the PRL Google Drive folder
 */
export async function listPRLFilesFromDrive(accessToken: string): Promise<DriveUploadedFile[]> {
  try {
    const folderId = await getOrCreatePRLFolder(accessToken);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,mimeType,webViewLink,createdTime)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
}
