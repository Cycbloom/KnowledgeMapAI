import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger';
import type { Graph, Edge, NodeLevel } from '@shared/types/graph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PDFOptions {
  includeScreenshot?: boolean;
  includeStats?: boolean;
  includeDetails?: boolean;
  screenshotBase64?: string;
}

interface PDFNode {
  id: string;
  title: string;
  content?: string;
  level: NodeLevel;
}

const LEVEL_ORDER: Record<NodeLevel, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };

type PDFDocumentInstance = InstanceType<typeof PDFDocument>;

export class PDFService {
  private fontPath: string | undefined;

  constructor() {
    this.initFontPath();
  }

  private initFontPath() {
    const projectFontDir = path.resolve(__dirname, '../../../assets/fonts');
    
    const findFontFile = (dir: string): string | null => {
      if (!fs.existsSync(dir)) return null;
      
      let files: fs.Dirent[] = [];
      try {
        files = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return null;
      }
      
      const noto = files.find(f => f.isFile() && /noto.*sc.*\.ttf$/i.test(f.name));
      if (noto) return path.join(dir, noto.name);

      for (const file of files) {
        if (file.isDirectory()) {
          const found = findFontFile(path.join(dir, file.name));
          if (found) return found;
        }
      }
      return null;
    };
    
    if (fs.existsSync(projectFontDir)) {
      const found = findFontFile(projectFontDir);
      if (found) {
        this.fontPath = found;
      } else {
         const files = fs.readdirSync(projectFontDir);
         const anyFont = files.find(f => /\.(ttf|otf|ttc)$/i.test(f));
         if (anyFont) this.fontPath = path.join(projectFontDir, anyFont);
      }
    }

    if (!this.fontPath && process.env.PDF_FONT_PATH && fs.existsSync(process.env.PDF_FONT_PATH)) {
        this.fontPath = process.env.PDF_FONT_PATH;
    }

    if (!this.fontPath) {
        const systemFonts = [
          'C:\\Windows\\Fonts\\simhei.ttf',
          'C:\\Windows\\Fonts\\msyh.ttf',
          'C:\\Windows\\Fonts\\simsun.ttc',
          '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
          '/usr/share/fonts/noto/NotoSansSC-Regular.otf',
          '/System/Library/Fonts/PingFang.ttc'
        ];
        for (const p of systemFonts) {
           if (fs.existsSync(p)) {
             this.fontPath = p;
             break;
           }
        }
    }
  }

  public generateReport(
    graph: Graph,
    nodes: PDFNode[],
    edges: Edge[],
    options: PDFOptions,
    outputStream: NodeJS.WritableStream
  ) {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    
    if (this.fontPath) {
      doc.registerFont('CN', this.fontPath);
      doc.font('CN');
    }

    doc.pipe(outputStream);

    this.renderCover(doc, graph, options);

    if (options.includeStats) {
      this.renderStats(doc, nodes, edges);
    }

    this.renderTOC(doc, nodes);

    if (options.includeDetails !== false) {
      this.renderNodeDetails(doc, nodes, edges);
    }

    doc.end();
  }

  private renderCover(doc: PDFDocumentInstance, graph: Graph, options: PDFOptions) {
    const title = typeof graph.title === 'string' && graph.title.trim() ? graph.title.trim() : 'Knowledge Graph Report';
    
    doc.fontSize(28).fillColor('#111827').text(title, { align: 'center' });
    doc.moveDown(0.5);
    
    if (graph.description) {
      doc.fontSize(12).fillColor('#4B5563').text(String(graph.description), { align: 'center' });
    }
    doc.moveDown(2);

    if (options.includeScreenshot && options.screenshotBase64) {
      try {
        const base64Data = options.screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        doc.image(buffer, {
          fit: [500, 300],
          align: 'center'
        });
        doc.moveDown(2);
      } catch (e) {
        logger.error('Failed to embed screenshot:', e);
        doc.fontSize(10).fillColor('#EF4444').text('[Screenshot rendering failed]', { align: 'center' });
      }
    }

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#9CA3AF').text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    
    doc.addPage();
  }

  private renderStats(doc: PDFDocumentInstance, nodes: PDFNode[], edges: Edge[]) {
    doc.fontSize(16).fillColor('#111827').text('图谱统计', { underline: true });
    doc.moveDown(1);

    const levelCounts: Record<string, number> = {
      'root': nodes.filter(n => n.level === 'root').length,
      'core': nodes.filter(n => n.level === 'core').length,
      'sub': nodes.filter(n => n.level === 'sub').length,
      'normal': nodes.filter(n => n.level === 'normal').length,
      'leaf': nodes.filter(n => n.level === 'leaf').length
    };

    const stats = [
      `总节点数: ${nodes.length}`,
      `总关联数: ${edges.length}`,
      `核心概念: ${levelCounts.root + levelCounts.core} 个`,
      `分支概念: ${levelCounts.sub} 个`,
      `知识细节: ${levelCounts.normal + levelCounts.leaf} 个`
    ];

    stats.forEach(stat => {
      doc.fontSize(11).fillColor('#374151').text(`• ${stat}`, { indent: 20 });
      doc.moveDown(0.3);
    });

    doc.moveDown(2);
  }

  private renderTOC(doc: PDFDocumentInstance, nodes: PDFNode[]) {
    doc.fontSize(16).fillColor('#111827').text('目录', { underline: true });
    doc.moveDown(1);

    const roots = nodes.filter(n => n.level === 'root');
    const cores = nodes.filter(n => n.level === 'core');

    roots.forEach(r => {
      doc.fontSize(12).fillColor('#2563EB').text(r.title);
      doc.moveDown(0.3);
    });

    cores.forEach(c => {
      doc.fontSize(11).fillColor('#4B5563').text(c.title, { indent: 20 });
      doc.moveDown(0.2);
    });

    doc.addPage();
  }

  private renderNodeDetails(doc: PDFDocumentInstance, nodes: PDFNode[], edges: Edge[]) {
    doc.fontSize(16).fillColor('#111827').text('详细内容', { underline: true });
    doc.moveDown(1.5);

    const sortedNodes = [...nodes].sort((a, b) => {
      const la = LEVEL_ORDER[a.level] ?? 5;
      const lb = LEVEL_ORDER[b.level] ?? 5;
      return la - lb;
    });

    const edgesBySource = new Map<string, Edge[]>();
    edges.forEach(e => {
        const list = edgesBySource.get(e.source_knowledge_point_id) || [];
        list.push(e);
        edgesBySource.set(e.source_knowledge_point_id, list);
    });
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    sortedNodes.forEach(node => {
      const color = node.level === 'root' ? '#7C3AED' : 
                    node.level === 'core' ? '#DC2626' : 
                    node.level === 'sub' ? '#D97706' : '#1F2937';
      
      doc.fontSize(14).fillColor(color).text(node.title);
      doc.moveDown(0.3);

      doc.fontSize(9).fillColor('#9CA3AF').text(`Type: ${node.level} | ID: ${node.id.substring(0,8)}`);
      doc.moveDown(0.5);

      if (node.content) {
        doc.fontSize(10).fillColor('#374151').text(node.content, { align: 'justify' });
        doc.moveDown(0.8);
      }

      const outgoing = edgesBySource.get(node.id);
      if (outgoing && outgoing.length > 0) {
        doc.fontSize(10).fillColor('#4B5563').text('关联:');
        outgoing.forEach(e => {
          const target = nodeById.get(e.target_knowledge_point_id);
          if (target) {
             doc.fontSize(9).fillColor('#6B7280')
               .text(`  -> ${target.title} [${e.relationship_type || 'related'}]`, { indent: 10 });
          }
        });
        doc.moveDown(0.5);
      }

      doc.moveDown(1);
      doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(1.5);
      
      if (doc.y > 700) {
        doc.addPage();
      }
    });
  }
}

export const pdfService = new PDFService();
