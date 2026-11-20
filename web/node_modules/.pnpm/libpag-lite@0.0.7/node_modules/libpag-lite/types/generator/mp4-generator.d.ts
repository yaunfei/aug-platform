import type { ByteData } from '../base/byte-data';
import type { VideoSequence } from '../base/video-sequence';
export interface MP4Flags {
    isLeading: number;
    isDependedOn: number;
    hasRedundancy: number;
    degradPrio: number;
    isNonSync: number;
    dependsOn: number;
    isKeyFrame: boolean;
}
export interface MP4Sample {
    index: number;
    size: number;
    duration: number;
    cts: number;
    flags: MP4Flags;
}
export interface MP4Track {
    id: number;
    type: string;
    len: number;
    sps: ByteData[];
    pps: ByteData[];
    width: number;
    height: number;
    timescale: number;
    duration: number;
    samples: MP4Sample[];
    pts: number[];
    implicitOffset: number;
}
export interface BoxParam {
    offset: number;
    timescale: number;
    duration: number;
    sequenceNumber: number;
    nalusBytesLen: number;
    baseMediaDecodeTime: number;
    track: MP4Track;
    videoSequence: VideoSequence;
    tracks: MP4Track[];
}
export declare class MP4Generator {
    private param;
    constructor(boxParam: BoxParam);
    ftyp(): Uint8Array;
    moov(): Uint8Array;
    moof(): Uint8Array;
    mdat(): Uint8Array;
    private mvhd;
    private trak;
    private tkhd;
    private edts;
    private elst;
    private mdia;
    private mdhd;
    private hdlr;
    private minf;
    private vmhd;
    private dinf;
    private dref;
    private stbl;
    private stsd;
    private avc1;
    private avcc;
    private stts;
    private ctts;
    private stss;
    private stsc;
    private stsz;
    private stco;
    private mvex;
    private trex;
    private mfhd;
    private traf;
    private tfhd;
    private tfdt;
    private trun;
    private sdtp;
}
