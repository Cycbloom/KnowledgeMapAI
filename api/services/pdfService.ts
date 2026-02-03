import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PDFOptions {
  includeScreenshot?: boolean;
  includeStats?: boolean;
  includeDetails?: boolean;
  screenshotBase64?: string;
}

export class PDFService {
  private doc: any;
  private fontPath: string | undefined;

  constructor() {
    this.doc = new PDFDocument({ size: 'A4', margin: 48 });
    this.initFonts();
  }

  private initFonts() {
    // Font selection strategy
    const projectFontDir = path.resolve(__dirname, '../../assets/fonts');
    
    // Helper to recursively find font
    const findFontFile = (dir: string): string | null => {
      if (!fs.existsSync(dir)) return null;
      
      let files: fs.Dirent[] = [];
      try {
        files = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return null;
      }
      
      // 1. Check current directory for Noto Sans SC (Priority)
      const noto = files.find(f => f.isFile() && /noto.*sc.*\.ttf$/i.test(f.name));
      if (noto) return path.join(dir, noto.name);

      // 2. Recurse into subdirectories
      for (const file of files) {
        if (file.isDirectory()) {
          const found = findFontFile(path.join(dir, file.name));
          if (found) return found;
        }
      }
      return null;
    };
    
    // 1. Try project assets
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

    // 2. Try configured path
    if (!this.fontPath && process.env.PDF_FONT_PATH && fs.existsSync(process.env.PDF_FONT_PATH)) {
        this.fontPath = process.env.PDF_FONT_PATH;
    }

    // 3. Try System fonts
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

    if (this.fontPath) {
      this.doc.registerFont('CN', this.fontPath);
      this.doc.font('CN');
    }
  }

  public generateReport(graph: any, nodes: any[], edges: any[], options: PDFOptions, outputStream: any) {
    this.doc.pipe(outputStream);

    // Cover Page
    this.renderCover(graph, options);

    // Stats Section
    if (options.includeStats) {
      this.renderStats(nodes, edges);
    }

    // Table of Contents
    this.renderTOC(nodes);

    // Node Details
    if (options.includeDetails !== false) {
      this.renderNodeDetails(nodes, edges);
    }

    this.doc.end();
  }

  private renderCover(graph: any, options: PDFOptions) {
    const title = typeof graph.title === 'string' && graph.title.trim() ? graph.title.trim() : 'Knowledge Graph Report';
    
    // Title
    this.doc.fontSize(28).fillColor('#111827').text(title, { align: 'center' });
    this.doc.moveDown(0.5);
    
    // Description
    if (graph.description) {
      this.doc.fontSize(12).fillColor('#4B5563').text(String(graph.description), { align: 'center' });
    }
    this.doc.moveDown(2);

    // Screenshot
    if (options.includeScreenshot && options.screenshotBase64) {
      try {
        const base64Data = options.screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Fit image within margins (A4 width ~595pt, margins 48pt -> available ~500pt)
        this.doc.image(buffer, {
          fit: [500, 300],
          align: 'center'
        });
        this.doc.moveDown(2);
      } catch (e) {
        console.error('Failed to embed screenshot:', e);
        this.doc.fontSize(10).fillColor('#EF4444').text('[Screenshot rendering failed]', { align: 'center' });
      }
    }

    // Date
    this.doc.moveDown(2);
    this.doc.fontSize(10).fillColor('#9CA3AF').text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    
    this.doc.addPage();
  }

  private renderStats(nodes: any[], edges: any[]) {
    this.doc.fontSize(16).fillColor('#111827').text('图谱统计 (Statistics)', { underline: true });
    this.doc.moveDown(1);

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
      this.doc.fontSize(11).fillColor('#374151').text(`• ${stat}`, { indent: 20 });
      this.doc.moveDown(0.3);
    });

    this.doc.moveDown(2);
  }

  private renderTOC(nodes: any[]) {
    // Simple TOC for Root/Core nodes
    this.doc.fontSize(16).fillColor('#111827').text('目录 (Contents)', { underline: true });
    this.doc.moveDown(1);

    const roots = nodes.filter(n => n.level === 'root');
    const cores = nodes.filter(n => n.level === 'core');

    roots.forEach(r => {
      this.doc.fontSize(12).fillColor('#2563EB').text(r.title);
      this.doc.moveDown(0.3);
    });

    cores.forEach(c => {
      this.doc.fontSize(11).fillColor('#4B5563').text(c.title, { indent: 20 });
      this.doc.moveDown(0.2);
    });

    this.doc.addPage();
  }

  private renderNodeDetails(nodes: any[], edges: any[]) {
    this.doc.fontSize(16).fillColor('#111827').text('详细内容 (Detailed Content)', { underline: true });
    this.doc.moveDown(1.5);

    // Sort nodes by level priority
    const levelOrder = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
    const sortedNodes = [...nodes].sort((a, b) => {
      const la = levelOrder[a.level as keyof typeof levelOrder] ?? 5;
      const lb = levelOrder[b.level as keyof typeof levelOrder] ?? 5;
      return la - lb;
    });

    // Map for edge lookup
    const edgesBySource = new Map<string, any[]>();
    edges.forEach(e => {
        const list = edgesBySource.get(e.source_node_id) || [];
        list.push(e);
        edgesBySource.set(e.source_node_id, list);
    });
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    sortedNodes.forEach(node => {
      // Header
      const color = node.level === 'root' ? '#7C3AED' : 
                    node.level === 'core' ? '#DC2626' : 
                    node.level === 'sub' ? '#D97706' : '#1F2937';
      
      this.doc.fontSize(14).fillColor(color).text(node.title);
      this.doc.moveDown(0.3);

      // Meta
      this.doc.fontSize(9).fillColor('#9CA3AF').text(`Type: ${node.level} | ID: ${node.id.substring(0,8)}`);
      this.doc.moveDown(0.5);

      // Content
      if (node.content) {
        this.doc.fontSize(10).fillColor('#374151').text(node.content, { align: 'justify' });
        this.doc.moveDown(0.8);
      }

      // Relations
      const outgoing = edgesBySource.get(node.id);
      if (outgoing && outgoing.length > 0) {
        this.doc.fontSize(10).fillColor('#4B5563').text('关联 (Related):');
        outgoing.forEach(e => {
          const target = nodeById.get(e.target_node_id);
          if (target) {
             this.doc.fontSize(9).fillColor('#6B7280')
               .text(`  -> ${target.title} [${e.relationship_type || 'related'}]`, { indent: 10 });
          }
        });
        this.doc.moveDown(0.5);
      }

      // Separator
      this.doc.moveDown(1);
      this.doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(48, this.doc.y).lineTo(547, this.doc.y).stroke();
      this.doc.moveDown(1.5);
      
      // Page break check (approximate)
      if (this.doc.y > 700) {
        this.doc.addPage();
      }
    });
  }
}

export const pdfService = new PDFService();
