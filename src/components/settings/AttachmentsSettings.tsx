'use client';

import React, { useState, useEffect } from 'react';
import { Search, FileText, Image, Link, Download, Calendar, Folder } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { toast } from 'sonner';

interface AttachmentWithContext {
  id: string;
  name: string;
  url: string;
  type: string;
  createdAt: string;
  card: {
    id: string;
    title: string;
    board: {
      id: string;
      title: string;
    };
  };
}

export const AttachmentsSettings: React.FC = () => {
  const [attachments, setAttachments] = useState<AttachmentWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');

  useEffect(() => {
    const fetchAttachments = async () => {
      try {
        const response = await fetch('/api/user/attachments');
        if (response.ok) {
          const data = await response.json();
          setAttachments(data);
        } else {
          toast.error('Failed to load attachments');
        }
      } catch (error) {
        console.error('Error fetching attachments:', error);
        toast.error('Failed to load attachments');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttachments();
  }, []);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type === 'link') return Link;
    return FileText;
  };

  const getFileTypeLabel = (type: string) => {
    if (type.startsWith('image/')) return 'Image';
    if (type === 'link') return 'Link';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('document')) return 'Document';
    return 'File';
  };

  const filteredAndSortedAttachments = attachments
    .filter(attachment => {
      const matchesSearch = attachment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           attachment.card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           attachment.card.board.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter === 'all' || 
                         (typeFilter === 'images' && attachment.type.startsWith('image/')) ||
                         (typeFilter === 'links' && attachment.type === 'link') ||
                         (typeFilter === 'documents' && !attachment.type.startsWith('image/') && attachment.type !== 'link');
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const typeStats = {
    total: attachments.length,
    images: attachments.filter(a => a.type.startsWith('image/')).length,
    links: attachments.filter(a => a.type === 'link').length,
    documents: attachments.filter(a => !a.type.startsWith('image/') && a.type !== 'link').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="grid grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{typeStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Image className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{typeStats.images}</p>
                <p className="text-xs text-muted-foreground">Images</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Link className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{typeStats.links}</p>
                <p className="text-xs text-muted-foreground">Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{typeStats.documents}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>All Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename, card, or board..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="images">Images</SelectItem>
                <SelectItem value="links">Links</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'type') => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="type">Sort by Type</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Attachments List */}
          <div className="space-y-4">
            {filteredAndSortedAttachments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No attachments found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || typeFilter !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Start adding attachments to your cards to see them here'}
                </p>
              </div>
            ) : (
              filteredAndSortedAttachments.map((attachment) => {
                const Icon = getFileIcon(attachment.type);
                const isImage = attachment.type.startsWith('image/');
                
                return (
                  <div
                    key={attachment.id}
                    className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Preview/Icon */}
                    <div className="flex-shrink-0">
                      {isImage ? (
                        <div className="w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <Icon className="h-6 w-6 text-muted-foreground hidden" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* File Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium truncate">{attachment.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {getFileTypeLabel(attachment.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Folder className="h-3 w-3" />
                          <span>{attachment.card.board.title}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span>{attachment.card.title}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(attachment.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(attachment.url, '_blank')}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 