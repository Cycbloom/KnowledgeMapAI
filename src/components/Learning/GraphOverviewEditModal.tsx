import React, { useState, useEffect } from 'react';
import { X, BookOpen, Link2, FileText, Plus, Pencil, Trash2, Save, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Graph, ReferenceBook, ExternalLink } from '../../../shared/types/graph';
import { ConfirmationModal } from '../common/ConfirmationModal';

type TabType = 'books' | 'links' | 'guide';

interface GraphOverviewEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  graph: Graph | null;
  onSave: (data: { reference_books?: ReferenceBook[]; external_links?: ExternalLink[]; learning_guide?: string }) => Promise<void>;
}

const emptyBook: ReferenceBook = {
  title: '',
  author: '',
  isbn: '',
  description: '',
  url: '',
};

const emptyLink: ExternalLink = {
  title: '',
  url: '',
  type: 'article',
  description: '',
};

export const GraphOverviewEditModal: React.FC<GraphOverviewEditModalProps> = ({
  isOpen,
  onClose,
  graph,
  onSave,
}) => {
  const { t } = useTranslation();

  const linkTypeOptions = [
    { value: 'article', label: t('learning.overviewEdit.typeArticle') },
    { value: 'video', label: t('learning.overviewEdit.typeVideo') },
    { value: 'course', label: t('learning.overviewEdit.typeCourse') },
    { value: 'tool', label: t('learning.overviewEdit.typeTool') },
    { value: 'other', label: t('learning.overviewEdit.typeOther') },
  ];

  const [activeTab, setActiveTab] = useState<TabType>('books');
  const [books, setBooks] = useState<ReferenceBook[]>([]);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [learningGuide, setLearningGuide] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [editingBookIndex, setEditingBookIndex] = useState<number | null>(null);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [bookForm, setBookForm] = useState<ReferenceBook>(emptyBook);
  const [linkForm, setLinkForm] = useState<ExternalLink>(emptyLink);
  const [bookErrors, setBookErrors] = useState<Partial<Record<keyof ReferenceBook, string>>>({});
  const [linkErrors, setLinkErrors] = useState<Partial<Record<keyof ExternalLink, string>>>({});
  
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'book' | 'link';
    index: number;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && graph) {
      setBooks(graph.reference_books || []);
      setLinks(graph.external_links || []);
      setLearningGuide(graph.learning_guide || '');
      setEditingBookIndex(null);
      setEditingLinkIndex(null);
      setBookForm(emptyBook);
      setLinkForm(emptyLink);
      setBookErrors({});
      setLinkErrors({});
      setShowPreview(false);
    }
  }, [isOpen, graph]);

  const validateBook = (book: ReferenceBook): boolean => {
    const errors: Partial<Record<keyof ReferenceBook, string>> = {};
    if (!book.title.trim()) {
      errors.title = t('learning.overviewEdit.validation.bookTitleRequired');
    }
    if (!book.author.trim()) {
      errors.author = t('learning.overviewEdit.validation.authorRequired');
    }
    if (book.url && !isValidUrl(book.url)) {
      errors.url = t('learning.overviewEdit.validation.invalidUrl');
    }
    setBookErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateLink = (link: ExternalLink): boolean => {
    const errors: Partial<Record<keyof ExternalLink, string>> = {};
    if (!link.title.trim()) {
      errors.title = t('learning.overviewEdit.validation.linkTitleRequired');
    }
    if (!link.url.trim()) {
      errors.url = t('learning.overviewEdit.validation.urlRequired');
    } else if (!isValidUrl(link.url)) {
      errors.url = t('learning.overviewEdit.validation.invalidUrl');
    }
    setLinkErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddBook = () => {
    if (!validateBook(bookForm)) return;
    setBooks([...books, bookForm]);
    setBookForm(emptyBook);
    setBookErrors({});
  };

  const handleUpdateBook = () => {
    if (editingBookIndex === null || !validateBook(bookForm)) return;
    const newBooks = [...books];
    newBooks[editingBookIndex] = bookForm;
    setBooks(newBooks);
    setEditingBookIndex(null);
    setBookForm(emptyBook);
    setBookErrors({});
  };

  const handleEditBook = (index: number) => {
    setEditingBookIndex(index);
    setBookForm(books[index]);
    setBookErrors({});
  };

  const handleDeleteBook = (index: number) => {
    const newBooks = books.filter((_, i) => i !== index);
    setBooks(newBooks);
    if (editingBookIndex === index) {
      setEditingBookIndex(null);
      setBookForm(emptyBook);
    }
  };

  const handleAddLink = () => {
    if (!validateLink(linkForm)) return;
    setLinks([...links, linkForm]);
    setLinkForm(emptyLink);
    setLinkErrors({});
  };

  const handleUpdateLink = () => {
    if (editingLinkIndex === null || !validateLink(linkForm)) return;
    const newLinks = [...links];
    newLinks[editingLinkIndex] = linkForm;
    setLinks(newLinks);
    setEditingLinkIndex(null);
    setLinkForm(emptyLink);
    setLinkErrors({});
  };

  const handleEditLink = (index: number) => {
    setEditingLinkIndex(index);
    setLinkForm(links[index]);
    setLinkErrors({});
  };

  const handleDeleteLink = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
    if (editingLinkIndex === index) {
      setEditingLinkIndex(null);
      setLinkForm(emptyLink);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        reference_books: books,
        external_links: links,
        learning_guide: learningGuide,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (activeTab === 'books') {
      setEditingBookIndex(null);
      setBookForm(emptyBook);
      setBookErrors({});
    } else if (activeTab === 'links') {
      setEditingLinkIndex(null);
      setLinkForm(emptyLink);
      setLinkErrors({});
    }
  };

  if (!isOpen) return null;

  const renderBooksTab = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
          {editingBookIndex !== null ? t('learning.overviewEdit.editBook') : t('learning.overviewEdit.addBook')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('learning.overviewEdit.bookTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bookForm.title}
              onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                bookErrors.title ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
              }`}
              placeholder={t('learning.overviewEdit.bookTitlePlaceholder')}
            />
            {bookErrors.title && (
              <p className="text-xs text-red-500 mt-1">{bookErrors.title}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('learning.overviewEdit.author')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bookForm.author}
              onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                bookErrors.author ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
              }`}
              placeholder={t('learning.overviewEdit.authorPlaceholder')}
            />
            {bookErrors.author && (
              <p className="text-xs text-red-500 mt-1">{bookErrors.author}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('learning.overviewEdit.isbn')}</label>
            <input
              type="text"
              value={bookForm.isbn || ''}
              onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('learning.overviewEdit.isbnPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('learning.overviewEdit.linkUrl')}</label>
            <input
              type="url"
              value={bookForm.url || ''}
              onChange={(e) => setBookForm({ ...bookForm, url: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                bookErrors.url ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
              }`}
              placeholder="https://..."
            />
            {bookErrors.url && (
              <p className="text-xs text-red-500 mt-1">{bookErrors.url}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('learning.overviewEdit.description')}</label>
            <textarea
              value={bookForm.description || ''}
              onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2}
              placeholder={t('learning.overviewEdit.bookDescriptionPlaceholder')}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {editingBookIndex !== null ? (
            <>
              <button
                onClick={handleUpdateBook}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Save size={16} />
                {t('learning.overviewEdit.updateBook')}
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                {t('learning.overviewEdit.cancel')}
              </button>
            </>
          ) : (
            <button
              onClick={handleAddBook}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus size={16} />
              {t('learning.overviewEdit.addBookButton')}
            </button>
          )}
        </div>
      </div>

      {books.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
            {t('learning.overviewEdit.addedBooks', { count: books.length })}
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {books.map((book, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
              >
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-slate-900 dark:text-slate-100 truncate">{book.title}</h5>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{book.author}</p>
                  {book.isbn && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">ISBN: {book.isbn}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleEditBook(index)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'book', index, title: book.title })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLinksTab = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
          {editingLinkIndex !== null ? t('learning.overviewEdit.editLink') : t('learning.overviewEdit.addLink')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('learning.overviewEdit.linkTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={linkForm.title}
              onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                linkErrors.title ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
              }`}
              placeholder={t('learning.overviewEdit.linkTitlePlaceholder')}
            />
            {linkErrors.title && (
              <p className="text-xs text-red-500 mt-1">{linkErrors.title}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t('learning.overviewEdit.type')}
            </label>
            <select
              value={linkForm.type}
              onChange={(e) => setLinkForm({ ...linkForm, type: e.target.value as ExternalLink['type'] })}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {linkTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={linkForm.url}
              onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                linkErrors.url ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
              }`}
              placeholder="https://..."
            />
            {linkErrors.url && (
              <p className="text-xs text-red-500 mt-1">{linkErrors.url}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('learning.overviewEdit.description')}</label>
            <textarea
              value={linkForm.description || ''}
              onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2}
              placeholder={t('learning.overviewEdit.linkDescriptionPlaceholder')}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {editingLinkIndex !== null ? (
            <>
              <button
                onClick={handleUpdateLink}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Save size={16} />
                {t('learning.overviewEdit.updateLink')}
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                {t('learning.overviewEdit.cancel')}
              </button>
            </>
          ) : (
            <button
              onClick={handleAddLink}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus size={16} />
              {t('learning.overviewEdit.addLinkButton')}
            </button>
          )}
        </div>
      </div>

      {links.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
            {t('learning.overviewEdit.addedLinks', { count: links.length })}
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {links.map((link, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-slate-900 dark:text-slate-100 truncate">{link.title}</h5>
                    <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full">
                      {linkTypeOptions.find(o => o.value === link.type)?.label || link.type}
                    </span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleEditLink(index)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'link', index, title: link.title })}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderGuideTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
          {t('learning.overviewEdit.learningGuide')}
        </h4>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPreview ? t('learning.overviewEdit.edit') : t('learning.overviewEdit.preview')}
        </button>
      </div>
      
      {showPreview ? (
        <div className="min-h-[300px] p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 prose prose-sm dark:prose-invert max-w-none">
          {learningGuide ? (
            <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{learningGuide}</div>
          ) : (
            <p className="text-slate-400 dark:text-slate-500 italic">{t('learning.overviewEdit.noGuideContent')}</p>
          )}
        </div>
      ) : (
        <textarea
          value={learningGuide}
          onChange={(e) => setLearningGuide(e.target.value)}
          className="w-full min-h-[300px] px-4 py-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono"
          placeholder={t('learning.overviewEdit.guidePlaceholder')}
        />
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-700 max-h-[95dvh] sm:max-h-[90dvh] flex flex-col">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('learning.overviewEdit.title')}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {graph?.title || t('learning.overviewEdit.unnamedGraph')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6">
            <button
              onClick={() => setActiveTab('books')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 min-h-[44px] ${
                activeTab === 'books'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen size={16} />
              {t('learning.overviewEdit.referenceBooks')}
              {books.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full">
                  {books.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 min-h-[44px] ${
                activeTab === 'links'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Link2 size={16} />
              {t('learning.overviewEdit.externalLinks')}
              {links.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full">
                  {links.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 min-h-[44px] ${
                activeTab === 'guide'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FileText size={16} />
              {t('learning.overviewEdit.learningGuide')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            {activeTab === 'books' && renderBooksTab()}
            {activeTab === 'links' && renderLinksTab()}
            {activeTab === 'guide' && renderGuideTab()}
          </div>

          <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
            >
              {t('learning.overviewEdit.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('learning.overviewEdit.saving')}
                </>
              ) : (
                <>
                  <Save size={18} />
                  {t('learning.overviewEdit.saveChanges')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            if (deleteConfirm.type === 'book') {
              handleDeleteBook(deleteConfirm.index);
            } else {
              handleDeleteLink(deleteConfirm.index);
            }
            setDeleteConfirm(null);
          }
        }}
        title={deleteConfirm?.type === 'book' ? t('learning.overviewEdit.confirmDeleteBook') : t('learning.overviewEdit.confirmDeleteLink')}
        message={t('learning.overviewEdit.confirmDeleteMessage', { title: deleteConfirm?.title || '' })}
        confirmText={t('learning.overviewEdit.delete')}
        isDangerous
      />
    </>
  );
};
