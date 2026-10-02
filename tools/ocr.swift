import Foundation
import PDFKit
import Vision
import AppKit
let url=URL(fileURLWithPath:CommandLine.arguments[1])
guard let doc=PDFDocument(url:url),doc.pageCount<=60 else {exit(2)}
var pages:[[String:Any]]=[]
var qr=false
for i in 0..<doc.pageCount {
 guard let page=doc.page(at:i) else {continue}
 let bounds=page.bounds(for:.mediaBox)
 let scale=min(2.5,2400/max(bounds.width,bounds.height))
 let w=Int(bounds.width*scale),h=Int(bounds.height*scale)
 guard let ctx=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {exit(3)}
 ctx.setFillColor(NSColor.white.cgColor);ctx.fill(CGRect(x:0,y:0,width:w,height:h));ctx.scaleBy(x:scale,y:scale);page.draw(with:.mediaBox,to:ctx)
 guard let image=ctx.makeImage() else {exit(4)}
 let request=VNRecognizeTextRequest(); request.recognitionLevel = .accurate;request.recognitionLanguages=["pt-BR","en-US"];request.usesLanguageCorrection=true
 let barcodes=VNDetectBarcodesRequest();barcodes.symbologies=[.qr]
 do { try VNImageRequestHandler(cgImage:image).perform([request]) } catch { fputs("Vision OCR falhou: \(error as NSError)\n",stderr);exit(5) }
do { try VNImageRequestHandler(cgImage:image).perform([barcodes]) } catch { fputs("Vision QR falhou: \(error as NSError)\n",stderr);exit(6) }
 let observations=(request.results ?? []).sorted { a,b in abs(a.boundingBox.midY-b.boundingBox.midY)>0.012 ? a.boundingBox.midY>b.boundingBox.midY : a.boundingBox.minX<b.boundingBox.minX }
 let text=observations.compactMap{$0.topCandidates(1).first?.string}.joined(separator:"\n")
 qr = qr || !(barcodes.results ?? []).isEmpty
 pages.append(["page":i+1,"text":text])
}
let result:[String:Any] = ["pages":pages,"qr":qr,"qrScanned":true]
let data=try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys])
FileHandle.standardOutput.write(data)
