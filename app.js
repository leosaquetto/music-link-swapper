const API_URL = "/api/convert";
const SAMPLE_URL = "https://music.apple.com/br/album/who-will-you-follow/1891104460?i=1891104594";

const REQUESTED_ADAPTERS = [
  "appleMusic",
  "spotify",
  "youTube",
  "deezer",
  "soundCloud",
  "pandora",
  "qobuz",
  "bandcamp",
  "tidal"
];

const STREAMING_HOST_HINTS = [
  "music.apple.com",
  "open.spotify.com",
  "spotify.link",
  "youtube.com",
  "youtu.be",
  "music.youtube.com",
  "deezer.com",
  "soundcloud.com",
  "tidal.com",
  "pandora.com",
  "qobuz.com",
  "bandcamp.com"
];

const SVG_ICONS = {
  telegram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M256 0C114.62 0 0 114.62 0 256s114.62 256 256 256s256-114.62 256-256S397.38 0 256 0Zm118.77 174.93l-41.37 195.03c-3.12 13.86-11.28 17.28-22.84 10.77l-63.11-46.52l-30.44 29.3c-3.37 3.37-6.19 6.19-12.68 6.19l4.54-64.33l117.12-105.84c5.09-4.54-1.12-7.09-7.87-2.55L173.4 288.22l-62.29-19.46c-13.56-4.25-13.86-13.56 2.82-20.08l243.5-93.85c11.28-4.25 21.14 2.55 17.34 20.1Z"/></svg>`,
  paste: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M7.5 6h1.67A3.001 3.001 0 0 0 12 8h6a3.001 3.001 0 0 0 2.83-2h1.67A1.5 1.5 0 0 1 24 7.5a1 1 0 1 0 2 0A3.5 3.5 0 0 0 22.5 4h-1.67A3.001 3.001 0 0 0 18 2h-6a3.001 3.001 0 0 0-2.83 2H7.5A3.5 3.5 0 0 0 4 7.5v19A3.5 3.5 0 0 0 7.5 30H12a1 1 0 1 0 0-2H7.5A1.5 1.5 0 0 1 6 26.5v-19A1.5 1.5 0 0 1 7.5 6ZM12 4h6a1 1 0 1 1 0 2h-6a1 1 0 1 1 0-2Zm5.5 6a3.5 3.5 0 0 0-3.5 3.5v13a3.5 3.5 0 0 0 3.5 3.5h8a3.5 3.5 0 0 0 3.5-3.5v-13a3.5 3.5 0 0 0-3.5-3.5h-8ZM16 13.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5v-13Z"/></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m23 1l-6 6M9 6q4-3 8 1t1 8l-6 8l-6-6l1-3l-3 1l-3-3Zm0 0l9 9"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M18.327 7.286h-8.044a1.932 1.932 0 0 0-1.925 1.938v10.088c0 1.07.862 1.938 1.925 1.938h8.044a1.932 1.932 0 0 0 1.925-1.938V9.224c0-1.07-.862-1.938-1.925-1.938"/><path d="M15.642 7.286V4.688c0-.514-.203-1.007-.564-1.37a1.918 1.918 0 0 0-1.361-.568H5.673c-.51 0-1 .204-1.36.568a1.945 1.945 0 0 0-.565 1.37v10.088c0 .514.203 1.007.564 1.37c.361.364.85.568 1.361.568h2.685"/></g></svg>`,
  open: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M7 17L17 7m0 0H9m8 0v8"/></svg>`,
  share: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M12 16V4m0 0l-4 4m4-4l4 4"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M5 13.5v3.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V13.5"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.1A9.12 9.12 0 0 0 7.63 20.2A9.35 9.35 0 0 0 18.64 8.88a.92.92 0 0 0-1.45-.95a6.63 6.63 0 0 1-8.84-3.8A.92.92 0 0 0 7 3.55a9.35 9.35 0 0 0 5 .94Z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3"/></g></svg>`,
  unlink: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 54.971 54.971" aria-hidden="true"><g fill="currentColor"><path d="M51.173,3.801c-5.068-5.068-13.315-5.066-18.384,0l-9.192,9.192c-0.781,0.781-0.781,2.047,0,2.828c0.781,0.781,2.047,0.781,2.828,0l9.192-9.192c1.691-1.69,3.951-2.622,6.363-2.622c2.413,0,4.673,0.932,6.364,2.623s2.623,3.951,2.623,6.364c0,2.412-0.932,4.672-2.623,6.363L36.325,31.379c-3.51,3.508-9.219,3.508-12.729,0c-0.781-0.781-2.047-0.781-2.828,0s-0.781,2.048,0,2.828c2.534,2.534,5.863,3.801,9.192,3.801s6.658-1.267,9.192-3.801l12.021-12.021c2.447-2.446,3.795-5.711,3.795-9.192C54.968,9.512,53.62,6.248,51.173,3.801z"/><path d="M27.132,40.57l-7.778,7.778c-1.691,1.691-3.951,2.623-6.364,2.623c-2.412,0-4.673-0.932-6.364-2.623c-3.509-3.509-3.509-9.219,0-12.728L17.94,24.306c1.691-1.69,3.951-2.622,6.364-2.622c2.412,0,4.672,0.932,6.363,2.622c0.781,0.781,2.047,0.781,2.828,0s0.781-2.047,0-2.828c-5.067-5.067-13.314-5.068-18.384,0L3.797,32.793c-2.446,2.446-3.794,5.711-3.794,9.192c0,3.48,1.348,6.745,3.795,9.191c2.446,2.447,5.711,3.795,9.191,3.795c3.481,0,6.746-1.348,9.192-3.795l7.778-7.778c0.781-0.781,0.781-2.047,0-2.828S27.913,39.789,27.132,40.57z"/></g></svg>`,
  verified: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.55879 3.6972C10.7552 2.02216 13.2447 2.02216 14.4412 3.6972L14.6317 3.96387C14.8422 4.25867 15.1958 4.41652 15.5558 4.37652L16.4048 4.28218C18.3156 4.06988 19.9301 5.68439 19.7178 7.59513L19.6235 8.44415C19.5835 8.8042 19.7413 9.15774 20.0361 9.36831L20.3028 9.55879C21.9778 10.7552 21.9778 13.2447 20.3028 14.4412L20.0361 14.6317C19.7413 14.8422 19.5835 15.1958 19.6235 15.5558L19.7178 16.4048C19.9301 18.3156 18.3156 19.9301 16.4048 19.7178L15.5558 19.6235C15.1958 19.5835 14.8422 19.7413 14.6317 20.0361L14.4412 20.3028C13.2447 21.9778 10.7553 21.9778 9.55879 20.3028L9.36831 20.0361C9.15774 19.7413 8.8042 19.5835 8.44414 19.6235L7.59513 19.7178C5.68439 19.9301 4.06988 18.3156 4.28218 16.4048L4.37652 15.5558C4.41652 15.1958 4.25867 14.8422 3.96387 14.6317L3.6972 14.4412C2.02216 13.2447 2.02216 10.7553 3.6972 9.55879L3.96387 9.36831C4.25867 9.15774 4.41652 8.8042 4.37652 8.44414L4.28218 7.59513C4.06988 5.68439 5.68439 4.06988 7.59513 4.28218L8.44415 4.37652C8.8042 4.41652 9.15774 4.25867 9.36831 3.96387L9.55879 3.6972ZM15.7071 9.29289C16.0976 9.68342 16.0976 10.3166 15.7071 10.7071L11.8882 14.526C11.3977 15.0166 10.6023 15.0166 10.1118 14.526L8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929C8.68342 10.9024 9.31658 10.9024 9.70711 11.2929L11 12.5858L14.2929 9.29289C14.6834 8.90237 15.3166 8.90237 15.7071 9.29289Z" fill="currentColor"/></svg>`,
  found: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.25007 2.38782C8.54878 2.0992 10.1243 2 12 2C13.8757 2 15.4512 2.0992 16.7499 2.38782C18.06 2.67897 19.1488 3.176 19.9864 4.01358C20.824 4.85116 21.321 5.94002 21.6122 7.25007C21.9008 8.54878 22 10.1243 22 12C22 13.8757 21.9008 15.4512 21.6122 16.7499C21.321 18.06 20.824 19.1488 19.9864 19.9864C19.1488 20.824 18.06 21.321 16.7499 21.6122C15.4512 21.9008 13.8757 22 12 22C10.1243 22 8.54878 21.9008 7.25007 21.6122C5.94002 21.321 4.85116 20.824 4.01358 19.9864C3.176 19.1488 2.67897 18.06 2.38782 16.7499C2.0992 15.4512 2 13.8757 2 12C2 10.1243 2.0992 8.54878 2.38782 7.25007C2.67897 5.94002 3.176 4.85116 4.01358 4.01358C4.85116 3.176 5.94002 2.67897 7.25007 2.38782ZM15.7071 9.29289C16.0976 9.68342 16.0976 10.3166 15.7071 10.7071L12.0243 14.3899C11.4586 14.9556 10.5414 14.9556 9.97568 14.3899L8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929C8.68342 10.9024 9.31658 10.9024 9.70711 11.2929L11 12.5858L14.2929 9.29289C14.6834 8.90237 15.3166 8.90237 15.7071 9.29289Z" fill="currentColor"/></svg>`,
  spotify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5c-.1-.4.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2Z"/></svg>`,
  qobuz: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 25" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 13.4434C12.521 13.4434 12.9434 13.021 12.9434 12.5C12.9434 11.979 12.521 11.5566 12 11.5566C11.479 11.5566 11.0566 11.979 11.0566 12.5C11.0566 13.021 11.479 13.4434 12 13.4434ZM12 15.7075C13.7715 15.7075 15.2075 14.2715 15.2075 12.5C15.2075 10.7285 13.7715 9.29245 12 9.29245C10.2285 9.29245 8.79245 10.7285 8.79245 12.5C8.79245 14.2715 10.2285 15.7075 12 15.7075Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2.5C17.5228 2.5 22 6.97715 22 12.5C22 14.8535 21.1869 17.0172 19.8264 18.7254L21.9029 20.8019L20.3019 22.4029L18.2254 20.3264C16.5172 21.6869 14.3535 22.5 12 22.5C6.47715 22.5 2 18.0228 2 12.5C2 6.97715 6.47715 2.5 12 2.5ZM19.7358 12.5C19.7358 8.22761 16.2724 4.76415 12 4.76415C7.72761 4.76415 4.26415 8.22761 4.26415 12.5C4.26415 16.7724 7.72761 20.2358 12 20.2358C13.7278 20.2358 15.3234 19.6694 16.611 18.712L15.1618 17.2628C14.7197 16.8207 14.7197 16.1039 15.1618 15.6618C15.6039 15.2197 16.3207 15.2197 16.7628 15.6618L18.212 17.111C19.1694 15.8234 19.7358 14.2278 19.7358 12.5Z" fill="currentColor"/></svg>`,
  pandora: `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M25.401 0h-18.803c-3.599 0-6.599 2.964-6.599 6.599v18.803c0 3.599 2.959 6.599 6.599 6.599h18.803c3.635 0 6.599-2.964 6.599-6.599v-18.803c0-3.599-2.964-6.599-6.599-6.599zM16.5 21.083h-1.64v3.72c0 0.479-0.401 0.859-0.86 0.859h-5.14v-19.317h8.739c4.245 0 7.527 2.197 7.527 7.197 0 4.74-3.641 7.537-8.604 7.537h-0.021z"/></svg>`,
  soundCloud: `<svg fill="currentColor" viewBox="-271 345.8 256 111.2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><path d="M-238.4,398.1c-0.8,0-1.4,0.6-1.5,1.5l-2.3,28l2.3,27.1c0.1,0.8,0.7,1.5,1.5,1.5c0.8,0,1.4-0.6,1.5-1.5l2.6-27.1l-2.6-28C-237,398.7-237.7,398.1-238.4,398.1z"/><path d="M-228.2,399.9c-0.9,0-1.7,0.7-1.7,1.7l-2.1,26l2.1,27.3c0.1,1,0.8,1.7,1.7,1.7c0.9,0,1.6-0.7,1.7-1.7l2.4-27.3l-2.4-26C-226.6,400.6-227.3,399.9-228.2,399.9z"/><path d="M-258.6,403.5c-0.5,0-1,0.4-1.1,1l-2.5,23l2.5,22.5c0.1,0.6,0.5,1,1.1,1c0.5,0,1-0.4,1.1-1l2.9-22.5l-2.9-23C-257.7,404-258.1,403.5-258.6,403.5z"/><path d="M-268.1,412.3c-0.5,0-1,0.4-1,1l-1.9,14.3l1.9,14c0.1,0.6,0.5,1,1,1s0.9-0.4,1-1l2.2-14l-2.2-14.2C-267.2,412.8-267.6,412.3-268.1,412.3z"/><path d="M-207.5,373.5c-1.2,0-2.1,0.9-2.2,2.1l-1.9,52l1.9,27.2c0.1,1.2,1,2.1,2.2,2.1s2.1-0.9,2.2-2.1l2.1-27.2l-2.1-52C-205.4,374.4-206.4,373.5-207.5,373.5z"/><path d="M-248.6,399c-0.7,0-1.2,0.5-1.3,1.3l-2.4,27.3l2.4,26.3c0.1,0.7,0.6,1.3,1.3,1.3c0.7,0,1.2-0.5,1.3-1.2l2.7-26.3l-2.7-27.3C-247.4,399.6-247.9,399-248.6,399z"/><path d="M-217.9,383.4c-1,0-1.9,0.8-1.9,1.9l-2,42.3l2,27.3c0.1,1.1,0.9,1.9,1.9,1.9s1.9-0.8,1.9-1.9l2.3-27.3l-2.3-42.3C-216,384.2-216.9,383.4-217.9,383.4z"/><path d="M-154.4,359.3c-1.8,0-3.2,1.4-3.2,3.2l-1.2,65l1.2,26.1c0,1.8,1.5,3.2,3.2,3.2c1.8,0,3.2-1.5,3.2-3.2l1.4-26.1l-1.4-65C-151.1,360.8-152.6,359.3-154.4,359.3z"/><path d="M-197.1,368.9c-1.3,0-2.3,1-2.4,2.4l-1.8,56.3l1.8,26.9c0,1.3,1.1,2.3,2.4,2.3s2.3-1,2.4-2.4l2-26.9l-2-56.3C-194.7,370-195.8,368.9-197.1,368.9z"/><path d="M-46.5,394c-4.3,0-8.4,0.9-12.2,2.4C-61.2,368-85,345.8-114,345.8c-7.1,0-14,1.4-20.1,3.8c-2.4,0.9-3,1.9-3,3.7v99.9c0,1.9,1.5,3.5,3.4,3.7c0.1,0,86.7,0,87.3,0c17.4,0,31.5-14.1,31.5-31.5C-15,408.1-29.1,394-46.5,394z"/><path d="M-143.6,353.2c-1.9,0-3.4,1.6-3.5,3.5l-1.4,70.9l1.4,25.7c0,1.9,1.6,3.4,3.5,3.4c1.9,0,3.4-1.6,3.5-3.5l1.5-25.8l-1.5-70.9C-140.2,354.8-141.7,353.2-143.6,353.2z"/><path d="M-186.5,366.8c-1.4,0-2.5,1.1-2.6,2.6l-1.6,58.2l1.6,26.7c0,1.4,1.2,2.6,2.6,2.6s2.5-1.1,2.6-2.6l1.8-26.7l-1.8-58.2C-184,367.9-185.1,366.8-186.5,366.8z"/><path d="M-175.9,368.1c-1.5,0-2.8,1.2-2.8,2.8l-1.5,56.7l1.5,26.5c0,1.6,1.3,2.8,2.8,2.8s2.8-1.2,2.8-2.8l1.7-26.5l-1.7-56.7C-173.1,369.3-174.3,368.1-175.9,368.1z"/><path d="M-165.2,369.9c-1.7,0-3,1.3-3,3l-1.4,54.7l1.4,26.3c0,1.7,1.4,3,3,3c1.7,0,3-1.3,3-3l1.5-26.3l-1.5-54.7C-162.2,371.3-163.5,369.9-165.2,369.9z"/></g></svg>`,
  appleMusic: `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m24 6.124c0-.029.001-.063.001-.097 0-.743-.088-1.465-.253-2.156l.013.063c-.312-1.291-1.1-2.359-2.163-3.031l-.02-.012c-.536-.35-1.168-.604-1.847-.723l-.03-.004c-.463-.084-1.003-.138-1.553-.15h-.011c-.04 0-.083-.01-.124-.013h-12.025c-.152.01-.3.017-.455.026-.791.016-1.542.161-2.242.415l.049-.015c-1.306.501-2.327 1.495-2.853 2.748l-.012.033c-.17.409-.297.885-.36 1.38l-.003.028c-.051.343-.087.751-.1 1.165v.016c0 .032-.007.062-.01.093v12.224c.01.14.017.283.027.424.02.861.202 1.673.516 2.416l-.016-.043c.609 1.364 1.774 2.387 3.199 2.792l.035.009c.377.111.817.192 1.271.227l.022.001c.555.053 1.11.06 1.667.06h11.028c.554 0 1.099-.037 1.633-.107l-.063.007c.864-.096 1.645-.385 2.321-.823l-.021.013c.825-.539 1.47-1.29 1.867-2.176l.013-.032c.166-.383.295-.829.366-1.293l.004-.031c.084-.539.132-1.161.132-1.794 0-.086-.001-.171-.003-.256v.013q0-5.7 0-11.394zm-6.424 3.99v5.712c.001.025.001.054.001.083 0 .407-.09.794-.252 1.14l.007-.017c-.273.562-.771.979-1.373 1.137l-.015.003c-.316.094-.682.156-1.06.173h-.01c-.029.002-.062.002-.096.002-1.033 0-1.871-.838-1.871-1.871 0-.741.431-1.382 1.056-1.685l.011-.005c.293-.14.635-.252.991-.32l.027-.004c.378-.082.758-.153 1.134-.24.264-.045.468-.252.51-.513v-.003c.013-.057.02-.122.02-.189 0-.002 0-.003 0-.005q0-2.723 0-5.443c-.001-.066-.01-.13-.027-.19l.001.005c-.026-.134-.143-.235-.283-.235-.006 0-.012 0-.018.001h.001c-.178.013-.34.036-.499.07l.024-.004q-1.14.225-2.28.456l-3.7.748c-.016 0-.032.01-.048.013-.222.03-.392.219-.392.447 0 .015.001.03.002.045v-.002.13q0 3.9 0 7.801c.001.028.001.062.001.095 0 .408-.079.797-.224 1.152l.007-.021c-.264.614-.792 1.072-1.436 1.235l-.015.003c-.319.096-.687.158-1.067.172h-.008c-.031.002-.067.003-.104.003-.913 0-1.67-.665-1.815-1.536l-.001-.011c-.02-.102-.031-.218-.031-.338 0-.785.485-1.458 1.172-1.733l.013-.004c.315-.127.687-.234 1.072-.305l.036-.005c.287-.06.575-.116.86-.177.341-.05.6-.341.6-.693 0-.007 0-.015 0-.022v.001-.15q0-4.44 0-8.883c0-.002 0-.004 0-.007 0-.129.015-.254.044-.374l-.002.011c.066-.264.277-.466.542-.517l.004-.001c.255-.066.515-.112.774-.165.733-.15 1.466-.3 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.4.181-.042.407-.079.637-.104l.027-.002c.018-.002.04-.004.061-.004.27 0 .489.217.493.485.008.067.012.144.012.222v.001q0 2.865 0 5.732z"/></svg>`,
  youTube: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><path fill="currentColor" d="M50,2.5C23.766,2.5,2.5,23.823,2.5,50.126c2.502,63.175,92.507,63.157,95-0.001C97.5,23.823,76.233,2.5,50,2.5z M50,77.399c-15.036,0-27.27-12.233-27.27-27.27c0.74-18.662,14.654-27.134,27.269-27.134c0.001,0,0.001,0,0.002,0c12.616,0.001,26.531,8.473,27.267,27.073C77.27,65.167,65.036,77.399,50,77.399z"/><path fill="currentColor" d="M50.002,26.103c-15.946-0.001-23.704,12.486-24.165,24.088C25.838,63.453,36.677,74.292,50,74.292S74.162,63.453,74.162,50.13C73.705,38.591,65.948,26.105,50.002,26.103z"/></g></svg>`,
  deezer: `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M24.511 22.011v3.785h6.484v-3.786h-6.486zM16.676 22.011v3.785h6.486v-3.786h-6.486zM8.84 22.011v3.785h6.484v-3.786h-6.486zM1.004 22.011v3.785h6.486v-3.786h-6.486zM24.511 16.742v3.783h6.484v-3.783h-6.484zM16.676 16.742v3.783h6.486v-3.783zM8.84 16.742v3.783h6.484v-3.783h-6.484zM24.51 11.476v3.783h6.486v-3.783zM8.84 11.476v3.783h6.484v-3.783h-6.484zM24.51 6.203v3.786h6.486v-3.786z"></path></svg>`,
  bandcamp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.29 6L2 18h14.71L22 6z"/></svg>`,
  tidal: `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16.016 5.323l-5.339 5.339-5.339-5.339-5.339 5.339 5.339 5.339 5.339-5.339 5.339 5.339-5.339 5.339 5.339 5.339 5.339-5.339-5.339-5.339 5.339-5.339zM21.391 10.661l5.302-5.307 5.307 5.307-5.307 5.307z"/></svg>`
};

const PLATFORM_META = {
  appleMusic: { name: "apple music", icon: SVG_ICONS.appleMusic, section: "principais", order: 1, isPrimaryCopy: true, appScheme: "music://" },
  spotify: { name: "spotify", icon: SVG_ICONS.spotify, section: "principais", order: 2, isPrimaryCopy: true, appScheme: "spotify://" },
  youTube: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true, appScheme: "youtubemusic://" },
  youtube: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true, appScheme: "youtubemusic://" },
  youtubeMusic: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true, appScheme: "youtubemusic://" },
  deezer: { name: "deezer", icon: SVG_ICONS.deezer, section: "principais", order: 4, isPrimaryCopy: true, appScheme: "deezer://" },
  tidal: { name: "tidal", icon: SVG_ICONS.tidal, section: "principais", order: 5, isPrimaryCopy: true, appScheme: "tidal://" },
  soundCloud: { name: "soundcloud", icon: SVG_ICONS.soundCloud, section: "outras", order: 6, isPrimaryCopy: false, appScheme: "soundcloud://" },
  pandora: { name: "pandora", icon: SVG_ICONS.pandora, section: "outras", order: 7, isPrimaryCopy: false, appScheme: "pandora://" },
  qobuz: { name: "qobuz", icon: SVG_ICONS.qobuz, section: "outras", order: 8, isPrimaryCopy: false, appScheme: "qobuz://" },
  bandcamp: { name: "bandcamp", icon: SVG_ICONS.bandcamp, section: "outras", order: 9, isPrimaryCopy: false, appScheme: null }
};

const SUPPORTED_PLATFORM_CHIPS = [
  "appleMusic",
  "spotify",
  "youTube",
  "deezer",
  "tidal",
  "soundCloud",
  "pandora",
  "qobuz"
];

const state = {
  currentResult: null,
  currentOriginalUrl: null,
  autoConvertedFromQuery: false,
  statusHideTimer: null,
  floatingToastTimer: null,
  lastClipboardText: "",
  lastAutoUrl: "",
  autoPasteInFlight: false,
  activeButtonResetTimers: new WeakMap(),
  scrollAfterConvert: false,
  hideResultTimer: null
};

const els = {
  input: document.getElementById("linkInput"),
  convertButton: document.getElementById("convertButton"),
  clearButton: document.getElementById("clearButton"),
  pasteButton: document.getElementById("pasteButton"),
  useSampleButton: document.getElementById("useSampleButton"),
  supportedChips: document.getElementById("supportedChips"),
  statusCard: document.getElementById("statusCard"),
  resultCard: document.getElementById("resultCard"),
  coverWrap: document.getElementById("coverWrap"),
  coverShimmer: document.getElementById("coverShimmer"),
  coverImage: document.getElementById("coverImage"),
  resultDescription: document.getElementById("resultDescription"),
  resultTitle: document.getElementById("resultTitle"),
  resultMeta: document.getElementById("resultMeta"),
  platformGroups: document.getElementById("platformGroups"),
  copyPrimaryButton: document.getElementById("copyPrimaryButton"),
  copyOriginalButton: document.getElementById("copyOriginalButton"),
  sharePrimaryButton: document.getElementById("sharePrimaryButton"),
  floatingToast: document.getElementById("floatingToast"),
  themeToggle: document.getElementById("themeToggle")
};

bootstrap();

function bootstrap() {
  injectButtonIcons();
  renderSupportedChips();
  initTheme();
  bindEvents();
  hydrateFromQuery();
  tryAutoPasteFromClipboard();
  bindTelegramAutoPaste();
}

function injectButtonIcons() {
  if (els.pasteButton) {
    els.pasteButton.innerHTML = `<span class="button-icon">${SVG_ICONS.paste}</span>`;
  }

  if (els.clearButton) {
    els.clearButton.innerHTML = `<span class="button-icon">${SVG_ICONS.clear}</span>`;
  }

  if (els.copyPrimaryButton) {
    els.copyPrimaryButton.innerHTML = `<span class="button-icon">${SVG_ICONS.copy}</span>`;
  }

  if (els.sharePrimaryButton) {
    els.sharePrimaryButton.innerHTML = `<span class="button-icon">${SVG_ICONS.share}</span>`;
  }

  if (els.copyOriginalButton) {
    els.copyOriginalButton.innerHTML = `<span class="button-icon">${SVG_ICONS.unlink}</span>`;
  }

  if (els.themeToggle) {
    syncThemeToggleIcon();
  }
}

function bindEvents() {
  els.themeToggle?.addEventListener("click", toggleTheme);

  els.convertButton?.addEventListener("click", () => {
    onConvert({ shouldScrollToStatus: true });
  });

  els.clearButton?.addEventListener("click", resetForm);

  els.pasteButton?.addEventListener("click", async () => {
    const pasted = await smartPasteIntoInput({ announce: true, autoConvert: true });

    if (!pasted) {
      els.input?.focus();
      els.input?.select?.();
      showFloatingToast("toque e cole o link no campo.");
    }
  });

  els.useSampleButton?.addEventListener("click", () => {
    els.input.value = SAMPLE_URL;
    hideStatus();
    softlyDismissKeyboard();
  });

  els.copyPrimaryButton?.addEventListener("click", async event => {
    if (!state.currentResult) return;
    const text = buildPrimaryLinksText(state.currentResult);
    if (!text) return;
    await copyText(text);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showFloatingToast("principais copiadas.");
  });

  els.sharePrimaryButton?.addEventListener("click", async event => {
    if (!state.currentResult) return;
    const text = buildPrimaryLinksText(state.currentResult);
    if (!text) return;

    const titleBits = [state.currentResult.artist, state.currentResult.title].filter(Boolean).join(" • ");

    if (navigator.share) {
      try {
        await navigator.share({
          title: titleBits || "music link swapper",
          text
        });
        pulseActionButton(event.currentTarget);
        triggerHaptic("light");
        showFloatingToast("principais compartilhadas.");
        return;
      } catch (_error) {}
    }

    await copyText(text);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showFloatingToast("principais copiadas.");
  });

  els.copyOriginalButton?.addEventListener("click", async event => {
    if (!state.currentOriginalUrl) return;
    await copyText(state.currentOriginalUrl);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showFloatingToast("link original copiado.");
  });

  els.input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConvert({ shouldScrollToStatus: true });
    }
  });

  els.input?.addEventListener("paste", () => {
    setTimeout(async () => {
      hideStatus();
      softlyDismissKeyboard();
      if (isSupportedStreamingUrl(extractUrl(els.input.value.trim()) || "")) {
        await onConvert({ shouldScrollToStatus: false });
      }
    }, 110);
  });
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const incomingUrl = extractUrl(params.get("url") || "");

  if (incomingUrl) {
    els.input.value = incomingUrl;
    state.autoConvertedFromQuery = true;
    state.lastAutoUrl = incomingUrl;
    showStatus("link recebido automaticamente.", "success", { autoHide: true });

    requestAnimationFrame(() => {
      setTimeout(() => {
        onConvert({ shouldScrollToStatus: false });
      }, 100);
    });
  }
}

async function tryAutoPasteFromClipboard() {
  if (els.input.value.trim()) return;
  if (window.Telegram?.WebApp) return;
  if (!navigator.clipboard?.readText) return;

  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);

    if (url && isSupportedStreamingUrl(url)) {
      els.input.value = url;
      state.lastClipboardText = typeof text === "string" ? text.trim() : "";
      state.lastAutoUrl = url;
    }
  } catch (_error) {}
}

function bindTelegramAutoPaste() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const run = () => {
    maybeAutoSwapFromTelegramClipboard();
  };

  run();
  tg.onEvent?.("activated", run);
}

async function maybeAutoSwapFromTelegramClipboard() {
  const tg = window.Telegram?.WebApp;
  if (!tg?.readTextFromClipboard) return;
  if (state.autoPasteInFlight) return;

  const startParam = tg?.initDataUnsafe?.start_param || "";
  const shouldForceAuto = startParam === "auto";

  state.autoPasteInFlight = true;

  const delay = isIOSDevice() ? 500 : 220;

  setTimeout(() => {
    tg.readTextFromClipboard(async text => {
      try {
        const rawText = typeof text === "string" ? text.trim() : "";
        if (!rawText) return;

        const url = extractUrl(rawText);
        if (!url || !isSupportedStreamingUrl(url)) return;

        const currentInput = extractUrl(els.input?.value?.trim?.() || "");
        const isSameAsInput = currentInput && currentInput === url;
        const isSameAsLastClipboard = state.lastClipboardText === rawText;
        const isSameAsLastAutoUrl = state.lastAutoUrl === url;

        if (!shouldForceAuto && (isSameAsInput || isSameAsLastClipboard || isSameAsLastAutoUrl)) {
          return;
        }

        state.lastClipboardText = rawText;
        state.lastAutoUrl = url;
        els.input.value = url;

        try {
          tg.HapticFeedback?.notificationOccurred?.("success");
        } catch (_error) {}

        showFloatingToast("link capturado do clipboard.");

        await onConvert({ shouldScrollToStatus: false });
      } finally {
        state.autoPasteInFlight = false;
      }
    });
  }, delay);
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

async function smartPasteIntoInput({ announce = false, autoConvert = false } = {}) {
  if (!navigator.clipboard?.readText) return false;

  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);

    if (url) {
      els.input.value = url;
      state.lastClipboardText = typeof text === "string" ? text.trim() : "";
      state.lastAutoUrl = url;
      softlyDismissKeyboard();
      if (announce) showFloatingToast("link colado no campo.");
      if (autoConvert && isSupportedStreamingUrl(url)) {
        setTimeout(() => onConvert({ shouldScrollToStatus: false }), 60);
      }
      return true;
    }

    return false;
  } catch (_error) {
    return false;
  }
}

async function onConvert({ shouldScrollToStatus = false } = {}) {
  const link = extractUrl(els.input.value.trim());
  state.scrollAfterConvert = shouldScrollToStatus;

  if (!link) {
    showStatus("cole um link válido para continuar.", "error");
    return;
  }

  if (!isSupportedStreamingUrl(link)) {
    showStatus("isso não parece um link de streaming suportado.", "error");
    return;
  }

  softlyDismissKeyboard();
  setLoading(true);
  hideResult();
  showStatus("swapando...", "default");
  startCoverShimmer();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        link,
        adapters: REQUESTED_ADAPTERS
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.links)) {
      stopCoverShimmer();
      showStatus(
        payload?.error || "não consegui converter esse link agora. tente novamente em instantes.",
        "error"
      );
      return;
    }

    const result = normalizeApiPayload(payload.data);
    if (!result) {
      stopCoverShimmer();
      showStatus("não encontrei plataformas para esse link.", "error");
      return;
    }

    state.currentOriginalUrl = link;
    state.currentResult = result;
    renderResult(result);
    showStatus(
      `${result.links.length} swap${result.links.length === 1 ? "" : "s"} encontrado${result.links.length === 1 ? "" : "s"}!`,
      "success"
    );

    if (state.scrollAfterConvert) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          els.statusCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, state.autoConvertedFromQuery ? 40 : 100);
      });
    }
  } catch (_error) {
    stopCoverShimmer();
    showStatus("deu erro na conversão. tente novamente em instantes.", "error");
  } finally {
    setLoading(false);
    state.autoConvertedFromQuery = false;
    state.scrollAfterConvert = false;
  }
}

function normalizeApiPayload(data) {
  const links = normalizeLinks(data.links);
  if (!links.length) return null;

  const rawTitle = cleanText(data.title || "música encontrada");
  const rawDescription = cleanText(data.description || "");
  const preview = parsePreview(rawTitle, rawDescription);
  const image = normalizeArtworkUrl(data.image || null);

  return {
    title: preview.title,
    artist: preview.artist,
    album: preview.album || cleanText(data.album || ""),
    image,
    universalLink: data.universalLink || null,
    links
  };
}

function normalizeArtworkUrl(url) {
  if (!url || typeof url !== "string") return null;

  let cleanImage = url.trim();

  if (cleanImage.includes("mzstatic.com")) {
    cleanImage = cleanImage.replace(/\/\d+x\d+[^/]*$/i, "/600x600bb.jpg");
  }

  return cleanImage;
}

function parsePreview(title, description) {
  const cleanTitleValue = cleanText(title);
  const cleanDescriptionValue = cleanText(description);

  if (!cleanDescriptionValue) {
    return {
      title: cleanTitleValue,
      artist: "",
      album: ""
    };
  }

  const separators = [" - ", " – ", " • ", " | "];
  let parts = [cleanDescriptionValue];

  for (const separator of separators) {
    if (cleanDescriptionValue.includes(separator)) {
      parts = cleanDescriptionValue.split(separator).map(cleanText).filter(Boolean);
      break;
    }
  }

  const normalizedTitle = normalizeComparisonText(cleanTitleValue);

  let filtered = parts
    .map(part => stripLeadingTitleFromPart(part, cleanTitleValue))
    .filter(Boolean)
    .filter(part => {
      const normalizedPart = normalizeComparisonText(part);
      return normalizedPart && normalizedPart !== normalizedTitle;
    });

  if (!filtered.length) {
    const fallbackArtist = stripLeadingTitleFromPart(cleanDescriptionValue, cleanTitleValue);
    const normalizedFallback = normalizeComparisonText(fallbackArtist);

    if (normalizedFallback && normalizedFallback !== normalizedTitle) {
      filtered = [fallbackArtist];
    }
  }

  if (!filtered.length) {
    return {
      title: cleanTitleValue,
      artist: "",
      album: ""
    };
  }

  return {
    title: cleanTitleValue,
    artist: filtered[0] || "",
    album: filtered.slice(1).join(" • ")
  };
}

function stripLeadingTitleFromPart(part, title) {
  const cleanPart = cleanText(part);
  const cleanTitle = cleanText(title);

  if (!cleanPart || !cleanTitle) return cleanPart;

  const normalizedPart = normalizeComparisonText(cleanPart);
  const normalizedTitle = normalizeComparisonText(cleanTitle);

  if (!normalizedPart || !normalizedTitle) return cleanPart;
  if (normalizedPart === normalizedTitle) return "";

  const regex = new RegExp(`^${escapeRegex(cleanTitle)}(?:\\s*[-–•|:]\\s*|\\s+)`, "i");
  const stripped = cleanPart.replace(regex, "").trim();

  if (!stripped) return "";
  if (normalizeComparisonText(stripped) === normalizedTitle) return "";

  return stripped;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeComparisonText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|•–:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderSupportedChips() {
  if (!els.supportedChips) return;

  els.supportedChips.innerHTML = SUPPORTED_PLATFORM_CHIPS
    .map(key => {
      const meta = PLATFORM_META[key];
      return `<span class="chip icon-chip icon-chip-${escapeHtml(key)}" title="${escapeHtml(meta.name)}" aria-label="${escapeHtml(meta.name)}">${meta.icon}</span>`;
    })
    .join("");
}

function renderResult(result) {
  clearTimeout(state.hideResultTimer);
  els.resultCard.classList.remove("hidden", "is-exiting");
  els.resultCard.classList.add("result-card-live");
  els.platformGroups.innerHTML = "";

  els.resultTitle.textContent = result.title || "resultado";
  els.resultMeta.textContent = buildMeta(result);

  if (result.artist) {
    els.resultDescription.textContent = result.artist;
    els.resultDescription.classList.remove("hidden");
  } else {
    els.resultDescription.classList.add("hidden");
    els.resultDescription.textContent = "";
  }

  if (result.image) {
    showCoverImage(result.image);
  } else {
    stopCoverShimmer();
    hideCoverImage();
  }

  const primaryText = buildPrimaryLinksText(result);
  if (primaryText) {
    els.copyPrimaryButton.classList.remove("hidden");
    els.sharePrimaryButton.classList.remove("hidden");
  } else {
    els.copyPrimaryButton.classList.add("hidden");
    els.sharePrimaryButton.classList.add("hidden");
  }

  if (state.currentOriginalUrl) {
    els.copyOriginalButton.classList.remove("hidden");
  } else {
    els.copyOriginalButton.classList.add("hidden");
  }

  const groups = ["principais", "outras"];
  for (const groupName of groups) {
    const items = result.links.filter(item => item.section === groupName);
    if (!items.length) continue;

    const section = document.createElement("section");
    const title = document.createElement("p");
    title.className = "group-title";
    title.textContent = groupName;
    section.appendChild(title);

    const list = document.createElement("div");
    list.className = "platform-list";

    items.forEach(item => list.appendChild(createPlatformItem(item)));
    section.appendChild(list);
    els.platformGroups.appendChild(section);
  }
}

function createPlatformItem(item) {
  const row = document.createElement("article");
  row.className = "platform-item";

  row.innerHTML = `
    <div class="platform-icon platform-icon-${escapeHtml(item.key)}">${item.icon}</div>
    <div class="platform-copy">
      <div class="platform-name-row">
        <div class="platform-name">${escapeHtml(item.name)}</div>
        <div class="platform-badge ${item.isVerified ? "is-verified" : "is-found"}" aria-label="${item.isVerified ? "verificado" : "encontrado"}">
          ${item.isVerified ? SVG_ICONS.verified : SVG_ICONS.found}
        </div>
      </div>
    </div>
    <div class="platform-actions">
      <button class="mini-action copy" type="button" data-action="copy" aria-label="copiar" title="copiar">
        <span class="button-icon">${SVG_ICONS.copy}</span>
      </button>
      <button class="mini-action share" type="button" data-action="share" aria-label="compartilhar" title="compartilhar">
        <span class="button-icon">${SVG_ICONS.share}</span>
      </button>
      <button class="mini-action open" type="button" data-action="open" aria-label="abrir" title="abrir">
        <span class="button-icon">${SVG_ICONS.open}</span>
      </button>
    </div>
  `;

  row.querySelector('[data-action="copy"]').addEventListener("click", async event => {
    await copyText(item.url);
    pulseActionButton(event.currentTarget);
    triggerHaptic("medium");
    showInlineToast(row, `${item.name} copiado.`);
  });

  row.querySelector('[data-action="share"]').addEventListener("click", async event => {
    const shared = await shareLink(item);
    pulseActionButton(event.currentTarget);
    triggerHaptic(shared ? "light" : "medium");

    if (shared) {
      showInlineToast(row, `${item.name} compartilhado.`);
    } else {
      await copyText(item.url);
      showInlineToast(row, `${item.name} copiado.`);
    }
  });

  row.querySelector('[data-action="open"]').addEventListener("click", event => {
    pulseActionButton(event.currentTarget, "open");
    triggerHaptic("light");
    openPlatformUrl(item);
  });

  return row;
}

function pulseActionButton(button, variant = "copy") {
  if (!button) return;

  const pressedClass = variant === "open" ? "is-pressed-open" : "is-pressed-copy";
  const resetTimers = state.activeButtonResetTimers;
  const previousTimer = resetTimers.get(button);

  if (previousTimer) {
    clearTimeout(previousTimer);
  }

  button.classList.remove("is-pressed-copy", "is-pressed-open");
  void button.offsetWidth;
  button.classList.add(pressedClass);

  const timeoutMs = variant === "open" ? 320 : 1000;
  const timer = setTimeout(() => {
    button.classList.remove(pressedClass);
    resetTimers.delete(button);
  }, timeoutMs);

  resetTimers.set(button, timer);
}

function triggerHaptic(kind = "light") {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg?.HapticFeedback) return;

    if (kind === "medium") {
      tg.HapticFeedback.impactOccurred("medium");
      return;
    }

    if (kind === "heavy") {
      tg.HapticFeedback.impactOccurred("heavy");
      return;
    }

    tg.HapticFeedback.impactOccurred("light");
  } catch (_error) {}
}

async function shareLink(item) {
  const titleBits = [state.currentResult?.artist, state.currentResult?.title].filter(Boolean).join(" • ");
  const shareTitle = titleBits || item.name;
  const shareText = [shareTitle, `${item.name}: ${item.url}`].filter(Boolean).join("\n");

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: item.url
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  return false;
}

function openPlatformUrl(item) {
  const url = item?.url;
  if (!url) return;

  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url, { try_instant_view: false });
    return;
  }

  const scheme = item.appScheme;
  if (scheme && isMobileDevice()) {
    const fallback = url;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = buildDeepLinkUrl(url, scheme);
    document.body.appendChild(iframe);

    setTimeout(() => {
      iframe.remove();
      window.open(fallback, "_blank", "noopener,noreferrer");
    }, 700);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function buildDeepLinkUrl(url, scheme) {
  try {
    const parsed = new URL(url);
    return `${scheme}${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch (_error) {
    return url;
  }
}

function isMobileDevice() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent || "");
}

function startCoverShimmer() {
  if (!els.coverWrap || !els.coverShimmer) return;
  els.coverWrap.classList.remove("hidden");
  els.coverShimmer.classList.remove("hidden");
  els.coverImage.classList.add("hidden");
  els.coverImage.removeAttribute("src");
}

function stopCoverShimmer() {
  els.coverShimmer?.classList.add("hidden");
}

function hideCoverImage() {
  els.coverWrap?.classList.add("hidden");
  els.coverImage?.classList.add("hidden");
  els.coverImage?.removeAttribute("src");
}

function showCoverImage(src) {
  if (!els.coverWrap || !els.coverImage) return;

  els.coverWrap.classList.remove("hidden");
  els.coverShimmer.classList.remove("hidden");
  els.coverImage.classList.add("hidden");

  const img = new Image();
  img.onload = () => {
    els.coverImage.src = src;
    els.coverImage.classList.remove("hidden");
    stopCoverShimmer();
  };
  img.onerror = () => {
    hideCoverImage();
    stopCoverShimmer();
  };
  img.src = src;
}

function showInlineToast(_container, message) {
  showFloatingToast(message);
}

function softlyDismissKeyboard() {
  try {
    els.input.blur();
    document.activeElement?.blur?.();
  } catch (_error) {}
}

function hideResult() {
  clearTimeout(state.hideResultTimer);

  if (!els.resultCard.classList.contains("hidden")) {
    els.resultCard.classList.remove("result-card-live");
    els.resultCard.classList.add("is-exiting");
    state.hideResultTimer = setTimeout(() => {
      els.platformGroups.innerHTML = "";
      els.copyPrimaryButton.classList.add("hidden");
      els.sharePrimaryButton.classList.add("hidden");
      els.copyOriginalButton.classList.add("hidden");
      hideCoverImage();
      els.resultCard.classList.remove("is-exiting");
      els.resultCard.classList.add("hidden");
    }, 220);
    return;
  }

  els.platformGroups.innerHTML = "";
  els.copyPrimaryButton.classList.add("hidden");
  els.sharePrimaryButton.classList.add("hidden");
  els.copyOriginalButton.classList.add("hidden");
  hideCoverImage();
}

function showStatus(message, tone = "default", { autoHide = false } = {}) {
  clearTimeout(state.statusHideTimer);
  els.statusCard.textContent = message;
  els.statusCard.classList.remove("hidden", "is-error", "is-success");
  if (tone === "error") els.statusCard.classList.add("is-error");
  if (tone === "success") els.statusCard.classList.add("is-success");

  if (autoHide) {
    state.statusHideTimer = setTimeout(() => {
      hideStatus();
    }, 2200);
  }
}

function hideStatus() {
  clearTimeout(state.statusHideTimer);
  els.statusCard.classList.add("hidden");
}

function showFloatingToast(message) {
  if (!els.floatingToast) return;

  clearTimeout(state.floatingToastTimer);
  els.floatingToast.textContent = message;
  els.floatingToast.classList.remove("hidden", "show");

  requestAnimationFrame(() => {
    els.floatingToast.classList.add("show");
  });

  state.floatingToastTimer = setTimeout(() => {
    els.floatingToast.classList.remove("show");
    els.floatingToast.classList.add("hidden");
  }, 2050);
}

function setLoading(loading) {
  els.convertButton.disabled = loading;
  els.convertButton.textContent = loading ? "swapando..." : "swap";
}

function resetForm() {
  els.input.value = "";
  softlyDismissKeyboard();
  hideStatus();
  hideResult();
  stopCoverShimmer();
  state.currentResult = null;
  state.currentOriginalUrl = null;
  state.autoConvertedFromQuery = false;
  state.lastAutoUrl = "";
}

function normalizeLinks(links) {
  const seen = new Set();
  const normalized = [];

  for (const item of links) {
    if (!item || !item.url || item.notAvailable) continue;

    const type = normalizePlatformKey(item.type);
    const meta = PLATFORM_META[type] || {
      name: prettifyPlatform(type),
      icon: "•",
      section: "outras",
      order: 999,
      isPrimaryCopy: false,
      appScheme: null
    };

    const dedupe = `${type}|${item.url}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    normalized.push({
      key: type,
      name: meta.name,
      icon: meta.icon,
      section: meta.section,
      order: meta.order,
      url: item.url,
      isVerified: !!item.isVerified,
      isPrimaryCopy: !!meta.isPrimaryCopy,
      appScheme: meta.appScheme || null
    });
  }

  normalized.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.isVerified && !b.isVerified) return -1;
    if (!a.isVerified && b.isVerified) return 1;
    return a.name.localeCompare(b.name);
  });

  return normalized;
}

function normalizePlatformKey(key) {
  if (!key) return "";
  if (key === "youtube" || key === "youtubeMusic") return "youTube";
  return key;
}

function prettifyPlatform(key) {
  return String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
}

function buildMeta(result) {
  const pieces = [];
  if (result.album) pieces.push(result.album);
  return pieces.join(" • ");
}

function buildPrimaryLinksText(result) {
  const items = result.links.filter(item => item.isPrimaryCopy);
  if (!items.length) return "";

  const lines = [];
  const heading = [result.artist, result.title].filter(Boolean).join("\n");
  if (heading) lines.push(heading);
  lines.push("");

  items.forEach((item, index) => {
    lines.push(`${item.name}: ${item.url}`);
    if (index < items.length - 1) lines.push("");
  });

  return lines.join("\n").trim();
}

function extractUrl(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/^https?:\/\/\S+$/i);
  if (direct) return direct[0];
  const embedded = trimmed.match(/https?:\/\/[^\s]+/i);
  if (embedded) return embedded[0];
  return null;
}

function isSupportedStreamingUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return STREAMING_HOST_HINTS.some(hint => lower.includes(hint));
}

function cleanText(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (window.Telegram?.WebApp?.Clipboard?.writeText) {
    window.Telegram.WebApp.Clipboard.writeText(text);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
}


function getPreferredTheme() {
  const persisted = localStorage.getItem("mls-theme");
  if (persisted === "light" || persisted === "dark") return persisted;

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function initTheme() {
  applyTheme(getPreferredTheme(), { persist: false });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "light" ? "dark" : "light");
}

function applyTheme(theme, { persist = true } = {}) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", normalized);
  syncThemeToggleIcon();

  if (persist) {
    localStorage.setItem("mls-theme", normalized);
  }

  window.dispatchEvent(new CustomEvent("mls-theme-change", { detail: { theme: normalized } }));
}

function syncThemeToggleIcon() {
  if (!els.themeToggle) return;

  const current = document.documentElement.getAttribute("data-theme") || "light";
  const isLight = current === "light";
  els.themeToggle.classList.add("is-switching");
  els.themeToggle.innerHTML = `<span class="button-icon">${isLight ? SVG_ICONS.moon : SVG_ICONS.sun}</span>`;
  els.themeToggle.setAttribute("aria-label", isLight ? "ativar modo escuro" : "ativar modo claro");
  els.themeToggle.setAttribute("title", isLight ? "modo escuro" : "modo claro");

  setTimeout(() => {
    els.themeToggle?.classList.remove("is-switching");
  }, 220);
  els.themeToggle.innerHTML = `<span class="button-icon">${isLight ? SVG_ICONS.moon : SVG_ICONS.sun}</span>`;
  els.themeToggle.setAttribute("aria-label", isLight ? "ativar modo escuro" : "ativar modo claro");
  els.themeToggle.setAttribute("title", isLight ? "modo escuro" : "modo claro");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
