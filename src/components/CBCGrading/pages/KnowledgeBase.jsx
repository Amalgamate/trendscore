import React from 'react';
import {
    BookOpen, HelpCircle, PlayCircle, FileText,
    ChevronRight, Search, Lightbulb, Book,
    MessageSquare, Video, Star
} from 'lucide-react';
import ProfileLayout from '../shared/ProfileLayout';
import { PRODUCT_DISPLAY_NAME } from '../../../config/productIdentity';

const KnowledgeBase = () => {
    const categories = [
        {
            title: "Getting Started",
            icon: PlayCircle,
            description: `New to ${PRODUCT_DISPLAY_NAME}? Start here for a quick tour.`,
            articles: [
                "Dashboard Overview",
                "Navigating the System",
                "First Time Setup Guide"
            ]
        },
        {
            title: "Tutor Guides",
            icon: Book,
            description: "Guides for managing classes and subjects.",
            articles: [
                "How to Mark Attendance",
                "Uploading Assessment Scores",
                "Managing your Timetable"
            ]
        },
        {
            title: "Parent Portal",
            icon: MessageSquare,
            description: "Tips for staying connected with your child's progress.",
            articles: [
                "Viewing Progress Reports",
                "Communicating with Teachers",
                "Fee Statement Explained"
            ]
        },
        {
            title: "Advanced Features",
            icon: Lightbulb,
            description: `Master the power-user tools of ${PRODUCT_DISPLAY_NAME}.`,
            articles: [
                "Custom Assessment Scales",
                "Bulk Student Promotion",
                "Integration with Biometrics"
            ]
        }
    ];

    const highlights = [
        { title: "New Feature", desc: "Check out the new Coding Playground!", type: "update" },
        { title: "Pro Tip", desc: "Use Excel imports to save time on assessments.", type: "tip" }
    ];

    return (
        <ProfileLayout
            title="Knowledge Base"
            subtitle="Tutorials, How-to's, and Institutional Guides"
            primaryAction={{
                label: "Submit Feedback",
                icon: MessageSquare,
                onClick: () => { }
            }}
        >
            <div className="space-y-8">
                {/* Hero / Search */}
                <div className="bg-[#2e1d2b] rounded-3xl p-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="relative z-10 max-w-2xl">
                        <h2 className="text-3xl font-medium mb-4">How can we help you today?</h2>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search tutorials, articles, or guides..."
                                className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:bg-white focus:text-gray-900 focus:ring-4 focus:ring-brand-teal/20 transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Grid Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categories.map((cat, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-xl hover:shadow-brand-teal/5 transition-all group cursor-pointer">
                            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-brand-teal">
                                <cat.icon size={24} />
                            </div>
                            <h3 className="font-medium text-gray-900 mb-2">{cat.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">{cat.description}</p>
                            <ul className="space-y-2">
                                {cat.articles.map((art, aIdx) => (
                                    <li key={aIdx} className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-brand-teal transition-colors">
                                        <ChevronRight size={12} />
                                        {art}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Video / News Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            <Video size={20} className="text-brand-teal" />
                            Featured Video Tutorials
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2].map(i => (
                                <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group cursor-pointer border border-gray-100">
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                            <PlayCircle size={32} className="text-brand-teal ml-1" />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 p-4 bg-black/60">
                                        <p className="text-white text-sm font-medium">Video Tutorial {i}: System Basics</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            <Star size={20} className="text-yellow-500" />
                            Highlights & Tips
                        </h3>
                        <div className="space-y-4">
                            {highlights.map((h, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-brand-teal/5 border border-brand-teal/10">
                                    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${h.type === 'update' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {h.title}
                                    </span>
                                    <p className="text-sm font-medium text-gray-700 mt-2">{h.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </ProfileLayout>
    );
};

export default KnowledgeBase;
