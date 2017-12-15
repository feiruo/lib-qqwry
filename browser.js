"use strict";
const QQwryPath = "data/qqwry.dat";

//从指定位置(g),读取指定(w*8)位数int
function readUIntLE(g, w) {
    g = g || 0;
    w = w < 1 ? 1 : w > 6 ? 6 : w;
    switch (w) {
        case 1:
            return ipFileBuffer.getUint8(g, true);
        case 3: //3个位移无符号整数?
            let a = u8a[g],
                b = u8a[g + 1],
                c = u8a[g + 2];
            return ((0 << 24) | (c << 16) | (b << 8) | a) >>> 0;
        case 4:
            return ipFileBuffer.getUint32(g, true);
    }
}

//读取字节,直到为0x00结束,返回数组
function setIpFileString(Begin) {
    let B = Begin || 0,
        toarr = [],
        M = u8a.length;
    B = B < 0 ? 0 : B;
    for (let i = B; i < M; i++) {
        if (u8a[i] == 0) return toarr;
        toarr.push(u8a[i]);
    }
    return toarr;
}
// 取得begin和end中间的偏移(用于2分法查询);
function GetMiddleOffset(begin, end, recordLength) {
    let records = ((end - begin) / recordLength >> 1) * recordLength + begin;
    return records ^ begin ? records : records + recordLength;
}

//2分法查找指定的IP偏移
function LocateIP(ip) {
    let g, temp;
    for (let b = ipBegin, e = ipEnd; b < e;) {
        g = GetMiddleOffset(b, e, IP_RECORD_LENGTH); //获取中间位置
        temp = readUIntLE(g, 4);
        if (ip > temp) {
            b = g;
        } else if (ip < temp) {
            if (g == e) {
                g -= IP_RECORD_LENGTH;
                break;
            }
            e = g;
        } else {
            break;
        }
    }
    return g;
}

function setIPLocation(g) {
    let Gjbut, ipwz = readUIntLE(g + 4, 3) + 4,
        lx = readUIntLE(ipwz, 1),
        loc = {};
    if (lx == REDIRECT_MODE_1) { //Country根据标识再判断
        ipwz = readUIntLE(ipwz + 1, 3); //读取国家偏移
        lx = readUIntLE(ipwz, 1); //再次获取标识字节
        if (lx == REDIRECT_MODE_2) { //再次检查标识字节
            Gjbut = setIpFileString(readUIntLE(ipwz + 1, 3));
            loc.Country = dc_GBK(Gjbut);
            ipwz = ipwz + 4;
        } else {
            Gjbut = setIpFileString(ipwz)
            loc.Country = dc_GBK(Gjbut);
            ipwz += Gjbut.length + 1;
        }
        loc.Area = ReadArea(ipwz);
    } else if (lx == REDIRECT_MODE_2) { //Country直接读取偏移处字符串
        Gjbut = setIpFileString(readUIntLE(ipwz + 1, 3));
        loc.Country = dc_GBK(Gjbut);
        loc.Area = ReadArea(ipwz + 4);
    } else { //Country直接读取 Area根据标志再判断
        Gjbut = setIpFileString(ipwz);
        ipwz += Gjbut.length + 1;
        loc.Country = dc_GBK(Gjbut);
        loc.Area = ReadArea(ipwz);
    }
    return loc;
}

//读取Area
function ReadArea(offset) {
    let one = readUIntLE(offset, 1);
    if (one == REDIRECT_MODE_1 || one == REDIRECT_MODE_2) {
        let areaOffset = readUIntLE(offset + 1, 3);
        if (areaOffset == 0)
            return 'unArea';
        else
            return dc_GBK(setIpFileString(areaOffset));
    } else
        return dc_GBK(setIpFileString(offset));
}

function ipToInt(IP) {
    var ip, result = IP_REGEXP.exec(IP);
    if (result) {
        var ip_Arr = result.slice(1);
        ip = (parseInt(ip_Arr[0]) << 24 | parseInt(ip_Arr[1]) << 16 | parseInt(ip_Arr[2]) << 8 | parseInt(ip_Arr[3])) >>> 0;
    } else if (/^\d+$/.test(IP) && (ip = parseInt(IP)) >= 0 && ip <= 0xFFFFFFFF) {
        ip = +IP
    } else {
        throw ("The IP address is not normal! >> " + IP);
    }
    return ip;
}

function intToIP(INT) {
    if (INT < 0 || INT > 0xFFFFFFFF) { throw ("The number is not normal! >> " + INT); };
    return (INT >>> 24) + "." + (INT >>> 16 & 0xFF) + "." + (INT >>> 8 & 0xFF) + "." + (INT >>> 0 & 0xFF);
}

function ipEndianChange(INT) {
    INT = INT & 0xFFFFFFFF;
    return (INT >>> 24 | (INT >> 8 & 0xFF00) | (INT << 8 & 0xFF0000) | (INT << 24)) >>> 0;
}
var u8a, ipFileBuffer, ipBegin, ipEnd,
    IP_RECORD_LENGTH = 7,
    REDIRECT_MODE_1 = 1,
    REDIRECT_MODE_2 = 2,
    IP_REGEXP = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;

var Qqwry = {
    IsReady: false,
    ipToInt,
    intToIP,
    ipEndianChange,
    init() {
        if (!QQwryPath) return this;
        let request = new XMLHttpRequest();
        request.open("GET", QQwryPath);
        request.responseType = "arraybuffer";
        request.onload = event => {
            u8a = new Uint8Array(request.response);
            ipFileBuffer = new DataView(request.response);
            ipBegin = ipFileBuffer.getUint32(0, true); //索引的开始位置;
            ipEnd = ipFileBuffer.getUint32(4, true); //索引的结束位置;
            this.IsReady = true;
        };
        request.send();
        return this
    },
    searchIP(IP) {
        if (!this.IsReady) return this.init();
        let ip = ipToInt(IP),
            g = LocateIP(ip),
            loc = {};
        if (g == -1) { return { "ip": IP, "Country": 'unArea', "Area": 'unCountry' }; }
        let add = setIPLocation(g);
        loc.int = ip;
        loc.ip = intToIP(ip);
        loc.Country = add.Country;
        loc.Area = add.Area;
        return loc;
    },
    searchIPScope(bginIP, endIP, callback) {
        var _ip1, _ip2, b_g, e_g, ips = [];
        try { _ip1 = ipToInt(bginIP); } catch (e) { throw ("The bginIP is not normal! >> " + bginIP); }
        try { _ip2 = ipToInt(endIP); } catch (e) { throw ("The endIP is not normal! >> " + endIP); }
        b_g = LocateIP(_ip1);
        e_g = LocateIP(_ip2);
        for (var i = b_g; i <= e_g; i += IP_RECORD_LENGTH) {
            var loc = {},
                add = setIPLocation(i);
            loc.begInt = readUIntLE(i, 4);
            loc.endInt = readUIntLE(readUIntLE(i + 4, 3), 4);
            loc.begIP = intToIP(loc.begInt);
            loc.endIP = intToIP(loc.endInt);
            loc.Country = add.Country;
            loc.Area = add.Area;
            ips.push(loc);
        }
        if (typeof callback == 'function') callback(ips);
        else return ips;
    },
}

qqwry.init();