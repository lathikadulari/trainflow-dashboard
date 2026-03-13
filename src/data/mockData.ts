import { Station, TrainApproach, DashboardStats, Log } from '@/types/train';

export const mockStations: Station[] = [
  {
    id: '1',
    name: 'Maradana',
    code: 'MAR',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's1-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's1-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 69
  },
  {
    id: '2',
    name: 'Dematagoda',
    code: 'DEM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's2-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's2-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 46
  },
  {
    id: '3',
    name: 'Kelaniya',
    code: 'KEL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's3-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's3-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 64
  },
  {
    id: '4',
    name: 'Wanawasala',
    code: 'WAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's4-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's4-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 66
  },
  {
    id: '5',
    name: 'Hunupitiya',
    code: 'HUN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's5-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's5-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 39
  },
  {
    id: '6',
    name: 'Enderamulla',
    code: 'END',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's6-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's6-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 99
  },
  {
    id: '7',
    name: 'Horape',
    code: 'HOR',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's7-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's7-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 62
  },
  {
    id: '8',
    name: 'Ragama',
    code: 'RAG',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's8-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's8-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 85
  },
  {
    id: '9',
    name: 'Walpola',
    code: 'WAL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's9-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's9-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 60
  },
  {
    id: '10',
    name: 'Batuwatte',
    code: 'BAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's10-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's10-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 52
  },
  {
    id: '11',
    name: 'Bulugahagoda',
    code: 'BUL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's11-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's11-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 22
  },
  {
    id: '12',
    name: 'Ganemulla',
    code: 'GAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's12-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's12-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 56
  },
  {
    id: '13',
    name: 'Yagoda',
    code: 'YAG',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's13-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's13-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 10
  },
  {
    id: '14',
    name: 'Gampaha',
    code: 'GAM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's14-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's14-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 41
  },
  {
    id: '15',
    name: 'Daraluwa',
    code: 'DAR',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's15-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's15-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 15
  },
  {
    id: '16',
    name: 'Bemmulla',
    code: 'BEM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's16-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's16-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '17',
    name: 'Magelegoda',
    code: 'MAG',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's17-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's17-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 21
  },
  {
    id: '18',
    name: 'Heendeniya',
    code: 'HEE',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's18-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's18-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 78
  },
  {
    id: '19',
    name: 'Veyangoda',
    code: 'VEY',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's19-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's19-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 58
  },
  {
    id: '20',
    name: 'Wandurawa',
    code: 'WAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's20-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's20-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 109
  },
  {
    id: '21',
    name: 'Keenawala',
    code: 'KEE',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's21-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's21-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 78
  },
  {
    id: '22',
    name: 'Pallewala',
    code: 'PAL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's22-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's22-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 41
  },
  {
    id: '23',
    name: 'Ganegoda',
    code: 'GAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's23-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's23-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '24',
    name: 'Wijayarajadahana',
    code: 'WIJ',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's24-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's24-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 24
  },
  {
    id: '25',
    name: 'Mihirigama',
    code: 'MIH',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's25-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's25-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 46
  },
  {
    id: '26',
    name: 'Wilwatte',
    code: 'WIL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's26-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's26-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 65
  },
  {
    id: '27',
    name: 'Botale',
    code: 'BOT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's27-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's27-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 62
  },
  {
    id: '28',
    name: 'Abeypussa',
    code: 'ABE',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's28-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's28-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 76
  },
  {
    id: '29',
    name: 'Yattalgoda',
    code: 'YAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's29-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's29-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 84
  },
  {
    id: '30',
    name: 'Buthgamuwa',
    code: 'BUT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's30-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's30-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 90
  },
  {
    id: '31',
    name: 'Alawwa',
    code: 'ALA',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's31-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's31-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 86
  },
  {
    id: '32',
    name: 'Wlakubura',
    code: 'WLA',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's32-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's32-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 70
  },
  {
    id: '33',
    name: 'Poplgahawela',
    code: 'POP',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's33-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's33-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 45
  },
  {
    id: '34',
    name: 'Panaleeya',
    code: 'PAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's34-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's34-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 29
  },
  {
    id: '35',
    name: 'Tismalpola',
    code: 'TIS',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's35-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's35-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 92
  },
  {
    id: '36',
    name: 'Yatagama',
    code: 'YAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's36-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's36-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 12
  },
  {
    id: '37',
    name: 'Rambukkana',
    code: 'RAM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's37-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's37-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 49
  },
  {
    id: '38',
    name: 'Kadigamuwa',
    code: 'KAD',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's38-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's38-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '39',
    name: 'Gangoda',
    code: 'GAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's39-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's39-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 42
  },
  {
    id: '40',
    name: 'Ihalakotte',
    code: 'IHA',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's40-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's40-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 45
  },
  {
    id: '41',
    name: 'Balana',
    code: 'BAL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's41-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's41-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 109
  },
  {
    id: '42',
    name: 'Kadugannawa',
    code: 'KAD',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's42-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's42-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 33
  },
  {
    id: '43',
    name: 'Pilimatalawa',
    code: 'PIL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's43-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's43-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 91
  },
  {
    id: '44',
    name: 'Peradeniya',
    code: 'PER',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's44-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's44-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 91
  },
  {
    id: '45',
    name: 'Koshinna',
    code: 'KOS',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's45-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's45-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '46',
    name: 'Gelioya',
    code: 'GEL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's46-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's46-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 72
  },
  {
    id: '47',
    name: 'Gampola',
    code: 'GAM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's47-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's47-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 107
  },
  {
    id: '48',
    name: 'Tembligala',
    code: 'TEM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's48-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's48-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 92
  },
  {
    id: '49',
    name: 'Ulapone',
    code: 'ULA',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's49-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's49-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 66
  },
  {
    id: '50',
    name: 'Nawalapitiya',
    code: 'NAW',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's50-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's50-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 18
  },
  {
    id: '51',
    name: 'Inguruoya',
    code: 'ING',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's51-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's51-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 19
  },
  {
    id: '52',
    name: 'Galaboda',
    code: 'GAL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's52-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's52-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 94
  },
  {
    id: '53',
    name: 'Watawala',
    code: 'WAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's53-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's53-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 42
  },
  {
    id: '54',
    name: 'Ihalawatawala',
    code: 'IHA',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's54-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's54-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 85
  },
  {
    id: '55',
    name: 'Rosella',
    code: 'ROS',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's55-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's55-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 41
  },
  {
    id: '56',
    name: 'Hatton',
    code: 'HAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's56-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's56-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 20
  },
  {
    id: '57',
    name: 'Kotagala',
    code: 'KOT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's57-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's57-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 82
  },
  {
    id: '58',
    name: 'Talawakele',
    code: 'TAL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's58-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's58-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 96
  },
  {
    id: '59',
    name: 'watagoda',
    code: 'WAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's59-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's59-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 65
  },
  {
    id: '60',
    name: 'Greatwestern',
    code: 'GRE',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's60-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's60-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 91
  },
  {
    id: '61',
    name: 'Radella',
    code: 'RAD',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's61-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's61-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 69
  },
  {
    id: '62',
    name: 'Nanuoya',
    code: 'NAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's62-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's62-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 10
  },
  {
    id: '63',
    name: 'Perakumpura',
    code: 'PER',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's63-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's63-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 40
  },
  {
    id: '64',
    name: 'Ambewela',
    code: 'AMB',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's64-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's64-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 54
  },
  {
    id: '65',
    name: 'Pattipola',
    code: 'PAT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's65-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's65-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 61
  },
  {
    id: '66',
    name: 'Ohiya',
    code: 'OHI',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's66-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's66-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '67',
    name: 'Idalgasinna',
    code: 'IDA',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's67-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's67-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 95
  },
  {
    id: '68',
    name: 'Haputale',
    code: 'HAP',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's68-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's68-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 96
  },
  {
    id: '69',
    name: 'Deyatalawa',
    code: 'DEY',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's69-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's69-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 24
  },
  {
    id: '70',
    name: 'Bandarawela',
    code: 'BAN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's70-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's70-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 108
  },
  {
    id: '71',
    name: 'Kinigama',
    code: 'KIN',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's71-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's71-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '72',
    name: 'Heeloya',
    code: 'HEE',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's72-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's72-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 32
  },
  {
    id: '73',
    name: 'Kitalelle',
    code: 'KIT',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's73-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's73-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 95
  },
  {
    id: '74',
    name: 'Elle',
    code: 'ELL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's74-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's74-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 25
  },
  {
    id: '75',
    name: 'Demodara',
    code: 'DEM',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's75-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's75-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 102
  },
  {
    id: '76',
    name: 'Uduwara',
    code: 'UDU',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's76-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's76-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 24
  },
  {
    id: '77',
    name: 'Haliela',
    code: 'HAL',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's77-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's77-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 95
  },
  {
    id: '78',
    name: 'Badulla',
    code: 'BAD',
    province: 'Unknown',
    line: 'Main Line',
    sensors: [
      { id: 's78-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's78-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 66
  },
  {
    id: '79',
    name: 'Peralanda',
    code: 'PER',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's79-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's79-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 10
  },
  {
    id: '80',
    name: 'Kandana',
    code: 'KAN',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's80-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's80-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 99
  },
  {
    id: '81',
    name: 'Kapuwatte',
    code: 'KAP',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's81-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's81-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 22
  },
  {
    id: '82',
    name: 'Ja-Ela',
    code: 'JAX',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's82-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's82-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 91
  },
  {
    id: '83',
    name: 'Tudella',
    code: 'TUD',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's83-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's83-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 76
  },
  {
    id: '84',
    name: 'Kudahakapola',
    code: 'KUD',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's84-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's84-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 76
  },
  {
    id: '85',
    name: 'Alawatupitiya',
    code: 'ALA',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's85-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's85-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 61
  },
  {
    id: '86',
    name: 'Seeduwa',
    code: 'SEE',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's86-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's86-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 53
  },
  {
    id: '87',
    name: 'Liyanagemulla',
    code: 'LIY',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's87-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's87-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 93
  },
  {
    id: '88',
    name: 'Katunayaka Airport',
    code: 'KAT',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's88-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's88-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 70
  },
  {
    id: '89',
    name: 'Katunayake',
    code: 'KAT',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's89-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's89-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 41
  },
  {
    id: '90',
    name: 'Trade Zoone',
    code: 'TRA',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's90-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's90-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 95
  },
  {
    id: '91',
    name: 'Kurana',
    code: 'KUR',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's91-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's91-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 28
  },
  {
    id: '92',
    name: 'Negombo',
    code: 'NEG',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's92-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's92-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 72
  },
  {
    id: '93',
    name: 'kattuwa',
    code: 'KAT',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's93-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's93-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 73
  },
  {
    id: '94',
    name: 'Kochchikade',
    code: 'KOC',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's94-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's94-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 65
  },
  {
    id: '95',
    name: 'Waikkala',
    code: 'WAI',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's95-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's95-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 69
  },
  {
    id: '96',
    name: 'Bolawatte',
    code: 'BOL',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's96-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's96-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 94
  },
  {
    id: '97',
    name: 'Borelessa',
    code: 'BOR',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's97-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's97-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 42
  },
  {
    id: '98',
    name: 'Lunuwila',
    code: 'LUN',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's98-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's98-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 11
  },
  {
    id: '99',
    name: 'Tummodara',
    code: 'TUM',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's99-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's99-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 84
  },
  {
    id: '100',
    name: 'Nattandiya',
    code: 'NAT',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's100-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's100-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 82
  },
  {
    id: '101',
    name: 'Walahapitiya',
    code: 'WAL',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's101-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's101-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 17
  },
  {
    id: '102',
    name: 'Kudawewa',
    code: 'KUD',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's102-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's102-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 32
  },
  {
    id: '103',
    name: 'Nelumpokuna',
    code: 'NEL',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's103-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's103-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 24
  },
  {
    id: '104',
    name: 'Madampe',
    code: 'MAD',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's104-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's104-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 26
  },
  {
    id: '105',
    name: 'Kakkapalliya',
    code: 'KAK',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's105-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's105-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 40
  },
  {
    id: '106',
    name: 'Sawarana',
    code: 'SAW',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's106-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's106-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 106
  },
  {
    id: '107',
    name: 'Chilaw',
    code: 'CHI',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's107-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's107-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 65
  },
  {
    id: '108',
    name: 'Manuwangama',
    code: 'MAN',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's108-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's108-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 101
  },
  {
    id: '109',
    name: 'Bangadeniya',
    code: 'BAN',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's109-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's109-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 104
  },
  {
    id: '110',
    name: 'Arachchikattuwa',
    code: 'ARA',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's110-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's110-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 33
  },
  {
    id: '111',
    name: 'Anawilundawa',
    code: 'ANA',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's111-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's111-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 74
  },
  {
    id: '112',
    name: 'Battaluoya',
    code: 'BAT',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's112-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's112-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 37
  },
  {
    id: '113',
    name: 'Pulachchikulam',
    code: 'PUL',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's113-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's113-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 74
  },
  {
    id: '114',
    name: 'Mundal',
    code: 'MUN',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's114-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's114-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 68
  },
  {
    id: '115',
    name: 'Mangalaeliya',
    code: 'MAN',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's115-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's115-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 66
  },
  {
    id: '116',
    name: 'Madurankuliya',
    code: 'MAD',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's116-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's116-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 53
  },
  {
    id: '117',
    name: 'Erukkalam pendu',
    code: 'ERU',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's117-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's117-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 11
  },
  {
    id: '118',
    name: 'Palavi',
    code: 'PAL',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's118-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's118-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 99
  },
  {
    id: '119',
    name: 'Thilladiya',
    code: 'THI',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's119-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's119-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 94
  },
  {
    id: '120',
    name: 'Puttalam',
    code: 'PUT',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's120-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's120-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 23
  },
  {
    id: '121',
    name: 'Noor Nagar',
    code: 'NOO',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's121-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's121-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 82
  },
  {
    id: '122',
    name: 'Karadipuwar',
    code: 'KAR',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's122-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's122-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '123',
    name: 'Periyanagavillu',
    code: 'PER',
    province: 'Unknown',
    line: 'Puttalam Line',
    sensors: [
      { id: 's123-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's123-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 85
  },
  {
    id: '124',
    name: 'Girambe',
    code: 'GIR',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's124-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's124-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 19
  },
  {
    id: '125',
    name: 'Talawattegedara',
    code: 'TAL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's125-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's125-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 87
  },
  {
    id: '126',
    name: 'Potuhera',
    code: 'POT',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's126-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's126-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 11
  },
  {
    id: '127',
    name: 'Nailiya',
    code: 'NAI',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's127-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's127-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 55
  },
  {
    id: '128',
    name: 'Kurunegala',
    code: 'KUR',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's128-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's128-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 23
  },
  {
    id: '129',
    name: 'Muththettugala',
    code: 'MUT',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's129-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's129-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '130',
    name: 'Wellawa',
    code: 'WEL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's130-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's130-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 26
  },
  {
    id: '131',
    name: 'Ganewatte',
    code: 'GAN',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's131-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's131-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '132',
    name: 'Yahapauwa',
    code: 'YAH',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's132-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's132-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 107
  },
  {
    id: '133',
    name: 'Nagollagama',
    code: 'NAG',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's133-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's133-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 43
  },
  {
    id: '134',
    name: 'Timbiriyagedara',
    code: 'TIM',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's134-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's134-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 18
  },
  {
    id: '135',
    name: 'Maho',
    code: 'MAH',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's135-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's135-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '136',
    name: 'Randenigama',
    code: 'RAN',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's136-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's136-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 39
  },
  {
    id: '137',
    name: 'Abanpola',
    code: 'ABA',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's137-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's137-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 26
  },
  {
    id: '138',
    name: 'Galgamuwa',
    code: 'GAL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's138-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's138-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 79
  },
  {
    id: '139',
    name: 'Senarathgama',
    code: 'SEN',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's139-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's139-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 100
  },
  {
    id: '140',
    name: 'Thambuttegama',
    code: 'THA',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's140-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's140-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '141',
    name: 'Talawa',
    code: 'TAL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's141-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's141-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 29
  },
  {
    id: '142',
    name: 'Srawasthipura',
    code: 'SRA',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's142-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's142-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 84
  },
  {
    id: '143',
    name: 'Anuradhapura Town',
    code: 'ANU',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's143-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's143-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 45
  },
  {
    id: '144',
    name: 'Anuradhapura',
    code: 'ANU',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's144-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's144-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 68
  },
  {
    id: '145',
    name: 'Mihintale Junction',
    code: 'MIH',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's145-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's145-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 90
  },
  {
    id: '146',
    name: 'Saliyapura',
    code: 'SAL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's146-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's146-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 100
  },
  {
    id: '147',
    name: 'Parasangahawewa',
    code: 'PAR',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's147-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's147-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 72
  },
  {
    id: '148',
    name: 'Medagama',
    code: 'MED',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's148-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's148-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '149',
    name: 'Medawachchiya',
    code: 'MED',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's149-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's149-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 71
  },
  {
    id: '150',
    name: 'Poonewa',
    code: 'POO',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's150-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's150-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 97
  },
  {
    id: '151',
    name: 'Erittaperiyakulam',
    code: 'ERI',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's151-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's151-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 55
  },
  {
    id: '152',
    name: 'Vavuniya',
    code: 'VAV',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's152-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's152-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 27
  },
  {
    id: '153',
    name: 'Mihintale',
    code: 'MIH',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's153-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's153-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '154',
    name: 'Parasangahawewa',
    code: 'PAR',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's154-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's154-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 77
  },
  {
    id: '155',
    name: 'Medawachchiya',
    code: 'MED',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's155-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's155-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 106
  },
  {
    id: '156',
    name: 'Vavuniya',
    code: 'VAV',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's156-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's156-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 43
  },
  {
    id: '157',
    name: 'Omantai',
    code: 'OMA',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's157-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's157-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 59
  },
  {
    id: '158',
    name: 'Puliyankulama',
    code: 'PUL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's158-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's158-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 53
  },
  {
    id: '159',
    name: 'Mankulam',
    code: 'MAN',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's159-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's159-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 79
  },
  {
    id: '160',
    name: 'Murukandi',
    code: 'MUR',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's160-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's160-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 30
  },
  {
    id: '161',
    name: 'Kilinochchi',
    code: 'KIL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's161-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's161-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 26
  },
  {
    id: '162',
    name: 'Paranthan',
    code: 'PAR',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's162-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's162-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 60
  },
  {
    id: '163',
    name: 'ElephantPass',
    code: 'ELE',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's163-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's163-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 17
  },
  {
    id: '164',
    name: 'Pallai',
    code: 'PAL',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's164-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's164-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 103
  },
  {
    id: '165',
    name: 'Kodikamam',
    code: 'KOD',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's165-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's165-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 31
  },
  {
    id: '166',
    name: 'Chavakachcheri',
    code: 'CHA',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's166-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's166-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '167',
    name: 'Navatkuli',
    code: 'NAV',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's167-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's167-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 97
  },
  {
    id: '168',
    name: 'Jaffna',
    code: 'JAF',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's168-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's168-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 66
  },
  {
    id: '169',
    name: 'Jaffna CSM',
    code: 'JAF',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's169-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's169-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 76
  },
  {
    id: '170',
    name: 'Jaffna SM',
    code: 'JAF',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's170-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's170-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 22
  },
  {
    id: '171',
    name: 'Kondavil',
    code: 'KON',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's171-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's171-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 32
  },
  {
    id: '172',
    name: 'Chunnakam',
    code: 'CHU',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's172-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's172-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 21
  },
  {
    id: '173',
    name: 'Kankesanthurei',
    code: 'KAN',
    province: 'Unknown',
    line: 'Northern Line',
    sensors: [
      { id: 's173-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's173-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 108
  },
  {
    id: '174',
    name: 'Konwewa',
    code: 'KON',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's174-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's174-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 55
  },
  {
    id: '175',
    name: 'Moragollagama',
    code: 'MOR',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's175-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's175-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 101
  },
  {
    id: '176',
    name: 'kekirawa',
    code: 'KEK',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's176-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's176-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 34
  },
  {
    id: '177',
    name: 'Kalawewa',
    code: 'KAL',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's177-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's177-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 104
  },
  {
    id: '178',
    name: 'Palugaswewa',
    code: 'PAL',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's178-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's178-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 102
  },
  {
    id: '179',
    name: 'Gal Oya Junction',
    code: 'GAL',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's179-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's179-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 65
  },
  {
    id: '180',
    name: 'Higurakgoda',
    code: 'HIG',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's180-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's180-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 97
  },
  {
    id: '181',
    name: 'Polonnaruwa',
    code: 'POL',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's181-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's181-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 30
  },
  {
    id: '182',
    name: 'Manampitiya',
    code: 'MAN',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's182-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's182-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 89
  },
  {
    id: '183',
    name: 'Welikanda',
    code: 'WEL',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's183-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's183-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 100
  },
  {
    id: '184',
    name: 'Punani',
    code: 'PUN',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's184-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's184-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 86
  },
  {
    id: '185',
    name: 'Valachchenai',
    code: 'VAL',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's185-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's185-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 83
  },
  {
    id: '186',
    name: 'Eravur',
    code: 'ERA',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's186-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's186-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 84
  },
  {
    id: '187',
    name: 'Batticaloa',
    code: 'BAT',
    province: 'Unknown',
    line: 'Batticaloa Line',
    sensors: [
      { id: 's187-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's187-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 21
  },
  {
    id: '188',
    name: 'Fort',
    code: 'FOR',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's188-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's188-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 46
  },
  {
    id: '189',
    name: 'Secretartat Halt',
    code: 'SEC',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's189-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's189-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '190',
    name: 'Kompnnavidiya',
    code: 'KOM',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's190-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's190-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 67
  },
  {
    id: '191',
    name: 'Kollupitiya',
    code: 'KOL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's191-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's191-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 58
  },
  {
    id: '192',
    name: 'Bambalapitiya',
    code: 'BAM',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's192-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's192-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 12
  },
  {
    id: '193',
    name: 'wellawatte',
    code: 'WEL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's193-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's193-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 57
  },
  {
    id: '194',
    name: 'Dehiwala',
    code: 'DEH',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's194-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's194-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 69
  },
  {
    id: '195',
    name: 'Mount Laviniya',
    code: 'MOU',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's195-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's195-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '196',
    name: 'Rathmalana',
    code: 'RAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's196-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's196-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 85
  },
  {
    id: '197',
    name: 'Angulana',
    code: 'ANG',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's197-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's197-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 98
  },
  {
    id: '198',
    name: 'Lunawa',
    code: 'LUN',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's198-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's198-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 20
  },
  {
    id: '199',
    name: 'Moratuwa',
    code: 'MOR',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's199-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's199-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 108
  },
  {
    id: '200',
    name: 'Koralawella',
    code: 'KOR',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's200-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's200-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 39
  },
  {
    id: '201',
    name: 'Egodauyana',
    code: 'EGO',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's201-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's201-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 90
  },
  {
    id: '202',
    name: 'Panadura',
    code: 'PAN',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's202-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's202-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 99
  },
  {
    id: '203',
    name: 'Pinwatte',
    code: 'PIN',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's203-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's203-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 21
  },
  {
    id: '204',
    name: 'Wadduwa',
    code: 'WAD',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's204-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's204-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 46
  },
  {
    id: '205',
    name: 'Train Halt',
    code: 'TRA',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's205-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's205-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 84
  },
  {
    id: '206',
    name: 'Kalutara North',
    code: 'KAL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's206-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's206-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 100
  },
  {
    id: '207',
    name: 'Kaluthara South',
    code: 'KAL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's207-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's207-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '208',
    name: 'Katukurunda',
    code: 'KAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's208-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's208-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 23
  },
  {
    id: '209',
    name: 'Payagala North',
    code: 'PAY',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's209-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's209-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 67
  },
  {
    id: '210',
    name: 'Payagala south',
    code: 'PAY',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's210-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's210-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 24
  },
  {
    id: '211',
    name: 'Maggona',
    code: 'MAG',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's211-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's211-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 20
  },
  {
    id: '212',
    name: 'Beruwala',
    code: 'BER',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's212-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's212-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '213',
    name: 'Hettimulla',
    code: 'HET',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's213-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's213-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 77
  },
  {
    id: '214',
    name: 'Aluthgama',
    code: 'ALU',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's214-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's214-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 14
  },
  {
    id: '215',
    name: 'Bentota',
    code: 'BEN',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's215-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's215-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 50
  },
  {
    id: '216',
    name: 'Induruwa',
    code: 'IND',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's216-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's216-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 95
  },
  {
    id: '217',
    name: 'Mha Induruwa',
    code: 'MHA',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's217-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's217-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 13
  },
  {
    id: '218',
    name: 'kosgoda',
    code: 'KOS',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's218-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's218-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 59
  },
  {
    id: '219',
    name: 'Piyagama',
    code: 'PIY',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's219-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's219-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 77
  },
  {
    id: '220',
    name: 'Ahungalle',
    code: 'AHU',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's220-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's220-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 58
  },
  {
    id: '221',
    name: 'Patagamgoda',
    code: 'PAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's221-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's221-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '222',
    name: 'Balapitiya',
    code: 'BAL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's222-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's222-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 15
  },
  {
    id: '223',
    name: 'Andadola',
    code: 'AND',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's223-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's223-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 59
  },
  {
    id: '224',
    name: 'Kandegoda',
    code: 'KAN',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's224-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's224-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 19
  },
  {
    id: '225',
    name: 'Ambalangoda',
    code: 'AMB',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's225-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's225-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '226',
    name: 'Madampagama',
    code: 'MAD',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's226-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's226-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 50
  },
  {
    id: '227',
    name: 'Akurala',
    code: 'AKU',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's227-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's227-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 36
  },
  {
    id: '228',
    name: 'Kahawa',
    code: 'KAH',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's228-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's228-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 73
  },
  {
    id: '229',
    name: 'Telwatte',
    code: 'TEL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's229-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's229-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 11
  },
  {
    id: '230',
    name: 'Seenigama',
    code: 'SEE',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's230-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's230-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 94
  },
  {
    id: '231',
    name: 'Hikkaduwa',
    code: 'HIK',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's231-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's231-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 74
  },
  {
    id: '232',
    name: 'Thiranagama',
    code: 'THI',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's232-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's232-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 17
  },
  {
    id: '233',
    name: 'Kumarakanda',
    code: 'KUM',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's233-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's233-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 27
  },
  {
    id: '234',
    name: 'Dodanduwa',
    code: 'DOD',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's234-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's234-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 47
  },
  {
    id: '235',
    name: 'Rathgama',
    code: 'RAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's235-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's235-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 59
  },
  {
    id: '236',
    name: 'Boossa',
    code: 'BOO',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's236-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's236-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '237',
    name: 'Ginthota',
    code: 'GIN',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's237-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's237-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 36
  },
  {
    id: '238',
    name: 'Piyadigama',
    code: 'PIY',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's238-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's238-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '239',
    name: 'Richmond Hill',
    code: 'RIC',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's239-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's239-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 84
  },
  {
    id: '240',
    name: 'Galle',
    code: 'GAL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's240-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's240-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 62
  },
  {
    id: '241',
    name: 'Katugoda',
    code: 'KAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's241-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's241-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 78
  },
  {
    id: '242',
    name: 'Unawatuna',
    code: 'UNA',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's242-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's242-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '243',
    name: 'Taple',
    code: 'TAP',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's243-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's243-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 43
  },
  {
    id: '244',
    name: 'Habaraduwa',
    code: 'HAB',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's244-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's244-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 76
  },
  {
    id: '245',
    name: 'Koggala',
    code: 'KOG',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's245-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's245-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 16
  },
  {
    id: '246',
    name: 'Kathaluwa',
    code: 'KAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's246-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's246-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 21
  },
  {
    id: '247',
    name: 'Ahangama',
    code: 'AHA',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's247-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's247-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 36
  },
  {
    id: '248',
    name: 'Midigama',
    code: 'MID',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's248-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's248-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 71
  },
  {
    id: '249',
    name: 'Kumbalgama',
    code: 'KUM',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's249-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's249-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 15
  },
  {
    id: '250',
    name: 'weligama',
    code: 'WEL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's250-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's250-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 65
  },
  {
    id: '251',
    name: 'Polwathumodara',
    code: 'POL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's251-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's251-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 24
  },
  {
    id: '252',
    name: 'Mirissa',
    code: 'MIR',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's252-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's252-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 14
  },
  {
    id: '253',
    name: 'Kamburugamuwa',
    code: 'KAM',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's253-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's253-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 27
  },
  {
    id: '254',
    name: 'Walgama',
    code: 'WAL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's254-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's254-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 18
  },
  {
    id: '255',
    name: 'Matara',
    code: 'MAT',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's255-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's255-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 72
  },
  {
    id: '256',
    name: 'Piliduwa',
    code: 'PIL',
    province: 'Unknown',
    line: 'Coastal Line',
    sensors: [
      { id: 's256-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's256-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '257',
    name: 'Baseline Road',
    code: 'BAS',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's257-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's257-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 22
  },
  {
    id: '258',
    name: 'Cotta Road',
    code: 'COT',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's258-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's258-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 25
  },
  {
    id: '259',
    name: 'Narahenpita',
    code: 'NAR',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's259-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's259-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 19
  },
  {
    id: '260',
    name: 'Kirulapone',
    code: 'KIR',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's260-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's260-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 78
  },
  {
    id: '261',
    name: 'Nugegoda',
    code: 'NUG',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's261-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's261-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 50
  },
  {
    id: '262',
    name: 'Udhamulla',
    code: 'UDH',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's262-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's262-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 98
  },
  {
    id: '263',
    name: 'Nawinna',
    code: 'NAW',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's263-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's263-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 96
  },
  {
    id: '264',
    name: 'maharagama',
    code: 'MAH',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's264-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's264-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 108
  },
  {
    id: '265',
    name: 'Pannipitiya',
    code: 'PAN',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's265-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's265-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 72
  },
  {
    id: '266',
    name: 'Kottawa',
    code: 'KOT',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's266-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's266-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 23
  },
  {
    id: '267',
    name: 'Malapalle',
    code: 'MAL',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's267-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's267-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 52
  },
  {
    id: '268',
    name: 'Homagama Hospital',
    code: 'HOM',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's268-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's268-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '269',
    name: 'Homagama',
    code: 'HOM',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's269-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's269-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 40
  },
  {
    id: '270',
    name: 'Panagoda',
    code: 'PAN',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's270-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's270-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 63
  },
  {
    id: '271',
    name: 'Godagama',
    code: 'GOD',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's271-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's271-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 56
  },
  {
    id: '272',
    name: 'Meegoda',
    code: 'MEE',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's272-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's272-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 100
  },
  {
    id: '273',
    name: 'Watareka',
    code: 'WAT',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's273-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's273-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 79
  },
  {
    id: '274',
    name: 'Padukka',
    code: 'PAD',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's274-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's274-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 34
  },
  {
    id: '275',
    name: 'Arukkuwatte',
    code: 'ARU',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's275-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's275-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 99
  },
  {
    id: '276',
    name: 'Angampitiya',
    code: 'ANG',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's276-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's276-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 76
  },
  {
    id: '277',
    name: 'Uggalla',
    code: 'UGG',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's277-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's277-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 82
  },
  {
    id: '278',
    name: 'Pinnawala',
    code: 'PIN',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's278-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's278-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 61
  },
  {
    id: '279',
    name: 'Gammana',
    code: 'GAM',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's279-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's279-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 28
  },
  {
    id: '280',
    name: 'Morakele',
    code: 'MOR',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's280-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's280-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 105
  },
  {
    id: '281',
    name: 'Waga',
    code: 'WAG',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's281-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's281-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 26
  },
  {
    id: '282',
    name: 'Kadugoda',
    code: 'KAD',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's282-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's282-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 48
  },
  {
    id: '283',
    name: 'Kosgama',
    code: 'KOS',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's283-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's283-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 39
  },
  {
    id: '284',
    name: 'puwakpitiya',
    code: 'PUW',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's284-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's284-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 38
  },
  {
    id: '285',
    name: 'Avisawella',
    code: 'AVI',
    province: 'Unknown',
    line: 'KV Line',
    sensors: [
      { id: 's285-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's285-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 55
  },
  {
    id: '286',
    name: 'Sarasaviyana',
    code: 'SAR',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's286-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's286-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 45
  },
  {
    id: '287',
    name: 'Kandy',
    code: 'KAN',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's287-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's287-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 88
  },
  {
    id: '288',
    name: 'Mahaiyawa',
    code: 'MAH',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's288-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's288-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 107
  },
  {
    id: '289',
    name: 'Katugastota',
    code: 'KAT',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's289-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's289-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 58
  },
  {
    id: '290',
    name: 'Udatalawinna',
    code: 'UDA',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's290-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's290-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 85
  },
  {
    id: '291',
    name: 'Wattegama',
    code: 'WAT',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's291-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's291-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 34
  },
  {
    id: '292',
    name: 'Pathanpha',
    code: 'PAT',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's292-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's292-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 11
  },
  {
    id: '293',
    name: 'Udaththawala',
    code: 'UDA',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's293-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's293-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 46
  },
  {
    id: '294',
    name: 'Ukuwela',
    code: 'UKU',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's294-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's294-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 45
  },
  {
    id: '295',
    name: 'Matale',
    code: 'MAT',
    province: 'Unknown',
    line: 'Matale Line',
    sensors: [
      { id: 's295-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's295-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 74
  },
  {
    id: '296',
    name: 'Kantale',
    code: 'KAN',
    province: 'Unknown',
    line: 'Trincomalee Line',
    sensors: [
      { id: 's296-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's296-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 42
  },
  {
    id: '297',
    name: 'Tambalagamuwa',
    code: 'TAM',
    province: 'Unknown',
    line: 'Trincomalee Line',
    sensors: [
      { id: 's297-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's297-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 68
  },
  {
    id: '298',
    name: 'China Bay',
    code: 'CHI',
    province: 'Unknown',
    line: 'Trincomalee Line',
    sensors: [
      { id: 's298-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's298-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 35
  },
  {
    id: '299',
    name: 'Trincomalee',
    code: 'TRI',
    province: 'Unknown',
    line: 'Trincomalee Line',
    sensors: [
      { id: 's299-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's299-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 29
  },
  {
    id: '300',
    name: 'Cheddikulam',
    code: 'CHE',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's300-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's300-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 55
  },
  {
    id: '301',
    name: 'Madu Road',
    code: 'MAD',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's301-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's301-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 96
  },
  {
    id: '302',
    name: 'Murunkan',
    code: 'MUR',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's302-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's302-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 42
  },
  {
    id: '303',
    name: 'Mannar',
    code: 'MAN',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's303-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's303-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 62
  },
  {
    id: '304',
    name: 'Pesalai',
    code: 'PES',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's304-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's304-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 69
  },
  {
    id: '305',
    name: 'Talaimannar',
    code: 'TAL',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's305-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's305-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 74
  },
  {
    id: '306',
    name: 'Talaimannar Pier',
    code: 'TAL',
    province: 'Unknown',
    line: 'Talaimannar Line',
    sensors: [
      { id: 's306-1', name: 'Sensor 1', status: 'online', lastPing: new Date() },
      { id: 's306-2', name: 'Sensor 2', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 22
  },
  {
    id: '307',
    name: 'Makumbura',
    code: 'MAK',
    province: 'Western',
    line: 'Kelani Valley Line',
    sensors: [
      { id: 's307-1', name: 'Sensor A', status: 'online', lastPing: new Date() },
      { id: 's307-2', name: 'Sensor B', status: 'online', lastPing: new Date() }
    ],
    totalApproaches: 0
  }
];

export const mockTrainApproaches: TrainApproach[] = [
  {
    id: 'ta1',
    trainId: 'TRN-4521',
    stationId: '1',
    stationName: 'Central Station',
    sensorId: 's1-1',
    speed: 85,
    distance: 12.5,
    destination: 'Kandy',
    timestamp: new Date(),
    status: 'approaching',
  },
  {
    id: 'ta2',
    trainId: 'TRN-7832',
    stationId: '2',
    stationName: 'North Terminal',
    sensorId: 's4-1',
    speed: 62,
    distance: 8.2,
    destination: 'Colombo Fort',
    timestamp: new Date(Date.now() - 120000),
    status: 'approaching',
  },
  {
    id: 'ta3',
    trainId: 'TRN-1194',
    stationId: '3',
    stationName: 'South Junction',
    sensorId: 's6-1',
    speed: 0,
    distance: 0,
    destination: 'Matara',
    timestamp: new Date(Date.now() - 300000),
    status: 'stopped',
  },
  {
    id: 'ta4',
    trainId: 'TRN-9956',
    stationId: '4',
    stationName: 'East Bridge',
    sensorId: 's9-1',
    speed: 95,
    distance: 15.8,
    destination: 'Badulla',
    timestamp: new Date(Date.now() - 60000),
    status: 'approaching',
  },
  {
    id: 'ta5',
    trainId: 'TRN-3347',
    stationId: '1',
    stationName: 'Central Station',
    sensorId: 's2-1',
    speed: 78,
    distance: 0,
    destination: 'Galle',
    timestamp: new Date(Date.now() - 180000),
    status: 'passed',
  },
];

export const mockDashboardStats: DashboardStats = {
  totalStations: 306,
  totalApproaches: 390,
  sensorsOnline: 550,
  sensorsOffline: 61,
  activeTrains: 4,
};

export const mockLogs: Log[] = [
  {
    id: 'l1',
    timestamp: new Date(),
    level: 'info',
    message: 'System started successfully',
    source: 'System',
  },
  {
    id: 'l2',
    timestamp: new Date(Date.now() - 3600000),
    level: 'error',
    message: 'Sensor B1 connection lost',
    source: 'Sensor B1',
  },
  {
    id: 'l3',
    timestamp: new Date(Date.now() - 7200000),
    level: 'warning',
    message: 'High latency detected',
    source: 'Network',
  },
  {
    id: 'l4',
    timestamp: new Date(Date.now() - 150000),
    level: 'info',
    message: 'Train TRN-4521 approaching Central Station',
    source: 'Sensor A1',
  },
  {
    id: 'l5',
    timestamp: new Date(Date.now() - 1800000),
    level: 'warning',
    message: 'Sensor W1 signal weak',
    source: 'Sensor W1',
  },
];
