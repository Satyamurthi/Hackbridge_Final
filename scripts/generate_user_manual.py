import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def add_callout(doc, text, title="NOTE", border_color="4F46E5", bg_color="F8FAFC"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    run_title = p.add_run(f"[{title}] ")
    run_title.bold = True
    run_title.font.name = "Arial"
    run_title.font.size = Pt(9.5)
    run_title.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
    
    run_text = p.add_run(text)
    run_text.font.name = "Arial"
    run_text.font.size = Pt(9.5)
    run_text.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    # spacing after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(4)

def format_table(table, header_bg="1E293B", alt_bg="F8FAFC"):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Format header row
    for cell in table.rows[0].cells:
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        for p in cell.paragraphs:
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            for r in p.runs:
                r.bold = True
                r.font.name = "Arial"
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                
    # Format alternating rows
    for i, row in enumerate(table.rows[1:], start=1):
        bg = alt_bg if i % 2 == 1 else "FFFFFF"
        for cell in row.cells:
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            for p in cell.paragraphs:
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.line_spacing = 1.15
                for r in p.runs:
                    r.font.name = "Arial"
                    r.font.size = Pt(9.0)
                    r.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

def build_manual():
    doc = docx.Document()
    
    # Page setup - 1 inch margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        
        # Header & Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("HackBridge SaaS — Comprehensive User Manual")
        hrun.font.name = "Arial"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)
        
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        frun1 = fp.add_run("Maharaja Institute of Technology Thandavapura (MITT) | Enterprise Hackathon Operations")
        frun1.font.name = "Arial"
        frun1.font.size = Pt(8.5)
        frun1.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Arial'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    normal_style.paragraph_format.line_spacing = 1.2
    normal_style.paragraph_format.space_after = Pt(6)

    # ──────────────────────────────────────────────────────────────────────────
    # COVER / TITLE BLOCK
    # ──────────────────────────────────────────────────────────────────────────
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(36)
    p_title.paragraph_format.space_after = Pt(6)
    r_title = p_title.add_run("HACKBRIDGE")
    r_title.bold = True
    r_title.font.name = "Arial"
    r_title.font.size = Pt(32)
    r_title.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5) # Indigo

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    r_sub = p_sub.add_run("Multi-Stakeholder Hackathon SaaS Platform")
    r_sub.bold = True
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(16)
    r_sub.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B) # Navy

    p_badge = doc.add_paragraph()
    p_badge.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_badge.paragraph_format.space_before = Pt(0)
    p_badge.paragraph_format.space_after = Pt(28)
    r_badge = p_badge.add_run("OFFICIAL USER OPERATIONS & NAVIGATION MANUAL")
    r_badge.bold = True
    r_badge.font.name = "Arial"
    r_badge.font.size = Pt(11)
    r_badge.font.color.rgb = RGBColor(0x0D, 0x94, 0x88) # Teal

    # Metadata Box
    meta_table = doc.add_table(rows=6, cols=2)
    meta_data = [
        ("Pilot Tenant Institution", "Maharaja Institute of Technology Thandavapura (MITT), Karnataka"),
        ("System Release", "Phase 12 Complete (Enterprise SaaS Release — 100% Spec Parity)"),
        ("Architecture", "React + Vite SPA, Supabase (PostgreSQL + RLS + Auth), Storage, BullMQ"),
        ("Audience", "College Administrators, Students, Evaluators, Corporate Recruiters, Mentors"),
        ("Document Version", "Version 2.0 (Updated September 2026)"),
        ("Security Level", "Multi-Tenant Row-Level Security (RLS) & Server-Enforced RBAC"),
    ]
    for row_idx, (k, v) in enumerate(meta_data):
        c0 = meta_table.cell(row_idx, 0)
        c1 = meta_table.cell(row_idx, 1)
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        c0.paragraphs[0].add_run(k).bold = True
        c1.paragraphs[0].add_run(v)
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "F8FAFC")
        set_cell_margins(c0, top=80, bottom=80, left=120, right=120)
        set_cell_margins(c1, top=80, bottom=80, left=120, right=120)
        for cell in (c0, c1):
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            for r in p.runs:
                r.font.name = "Arial"
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

    doc.add_page_break()

    # Helper function for headings
    def add_h1(title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(20)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(title)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(16)
        r.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        return p

    def add_h2(title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(title)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)
        return p

    def add_h3(title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(title)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(0x0F, 0x76, 0x6E)
        return p

    # ──────────────────────────────────────────────────────────────────────────
    # TABLE OF CONTENTS
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("Table of Contents")
    toc_items = [
        ("1. Executive Overview & System Architecture", "Core design, multi-tenant isolation, roles"),
        ("2. Platform Access, Registration & Authentication", "Sign up workflows, role whitelisting, login security"),
        ("3. Global Interface & Shared Tools", "Top navigation bar, role-based sidebar, notification center"),
        ("4. College Admin & Committee Member Guide", "Hackathon lifecycles, company approvals, problem curation, AI triage"),
        ("5. Student & Participant Guide", "Profile & portfolio setup, team formation, submissions, career offers"),
        ("6. Industry Partner & Recruiter Guide", "Corporate onboarding, problem statements, talent pool scouting"),
        ("7. Evaluator (Judge) Guide", "Double-blind queue, conflict of interest recusal, dynamic rubric scoring"),
        ("8. Public Championship Leaderboard", "Live standings, podium showcase, verified credential inspection"),
        ("9. Institutional Compliance, Audit Trail & Security", "Tamper-proof logs, server-side RBAC, fail-closed design"),
        ("10. Troubleshooting, Technical Reference & FAQs", "Common scenarios, file upload limits, browser compatibility"),
    ]
    toc_table = doc.add_table(rows=len(toc_items) + 1, cols=2)
    toc_table.cell(0, 0).paragraphs[0].add_run("Section")
    toc_table.cell(0, 1).paragraphs[0].add_run("Summary & Core Capabilities")
    toc_table.cell(0, 0).width = Inches(3.2)
    toc_table.cell(0, 1).width = Inches(3.3)
    for idx, (sec, desc) in enumerate(toc_items, start=1):
        c0 = toc_table.cell(idx, 0)
        c1 = toc_table.cell(idx, 1)
        c0.width = Inches(3.2)
        c1.width = Inches(3.3)
        c0.paragraphs[0].add_run(sec).bold = True
        c1.paragraphs[0].add_run(desc)
    format_table(toc_table, header_bg="1E293B", alt_bg="F8FAFC")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 1: EXECUTIVE OVERVIEW
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("1. Executive Overview & System Architecture")
    
    p = doc.add_paragraph()
    p.add_run(
        "HackBridge is an enterprise multi-stakeholder hackathon SaaS platform specifically engineered "
        "for engineering colleges and universities. The platform establishes an integrated digital bridge "
        "connecting students, college administrators, faculty committee members, double-blind industry evaluators, "
        "and corporate talent acquisition teams into a cohesive, secure ecosystem."
    )
    
    add_h2("1.1 Multi-Tenant White-Label Architecture")
    p = doc.add_paragraph()
    p.add_run(
        "The application is built around strict multi-tenant isolation. Every user, hackathon event, team, "
        "problem statement, and submission is scoped to a specific university tenant (such as Maharaja Institute "
        "of Technology Thandavapura — MITT). Database-level PostgreSQL Row Level Security (RLS) guarantees "
        "that cross-tenant data leakage is physically impossible at the query layer."
    )

    add_h2("1.2 Stakeholder Role Taxonomy & Permission Matrix")
    p = doc.add_paragraph()
    p.add_run(
        "HackBridge enforces seven specialized system roles, each provisioned with a bespoke workspace "
        "and granular capability boundaries:"
    )

    roles_table = doc.add_table(rows=8, cols=3)
    roles_table.cell(0, 0).paragraphs[0].add_run("System Role")
    roles_table.cell(0, 1).paragraphs[0].add_run("Primary Scope & Responsibilities")
    roles_table.cell(0, 2).paragraphs[0].add_run("Primary Routes & Desks")
    roles_table.cell(0, 0).width = Inches(1.8)
    roles_table.cell(0, 1).width = Inches(3.0)
    roles_table.cell(0, 2).width = Inches(1.7)

    role_rows = [
        ("College Admin", "Hackathon lifecycle state machine, company approvals, problem review, evaluator assignments, awards, compliance audit.", "/admin, /admin/hackathons, /admin/problems, /admin/prescreening, /admin/results, /admin/audit"),
        ("Committee Member", "Reviewing industry problem statements, pre-screening project submissions, assigning evaluators, deliberation matrix.", "/admin/problems, /admin/prescreening, /admin/results"),
        ("Student", "Profile & verified portfolio, team creation/join via invite codes, challenge locking, multi-format submissions, career offers.", "/student, /student/portfolio, /student/teams, /student/problems, /student/submissions, /student/offers"),
        ("Company Representative", "Corporate profile onboarding, submitting challenge statements, candidate scouting, recruiter outreach & job offers.", "/company, /company/profile, /company/problems, /company/talent"),
        ("Evaluator (Judge)", "Double-blind evaluation queue, conflict of interest recusal, multi-criterion dynamic rubric scoring, jury feedback.", "/evaluator, /evaluator/assignments, /evaluator/score/:id"),
        ("Super Admin", "Institutional tenant provisioning, university white-label domain configuration, global platform infrastructure audit.", "/admin/tenants, /admin/audit"),
        ("Mentor / Guest", "Guiding student teams during hacking sprints, public championship leaderboard viewing, verified candidate profile discovery.", "/leaderboard, /p/:profileId"),
    ]
    for r_idx, (r_name, r_scope, r_routes) in enumerate(role_rows, start=1):
        c0 = roles_table.cell(r_idx, 0)
        c1 = roles_table.cell(r_idx, 1)
        c2 = roles_table.cell(r_idx, 2)
        c0.width = Inches(1.8)
        c1.width = Inches(3.0)
        c2.width = Inches(1.7)
        c0.paragraphs[0].add_run(r_name).bold = True
        c1.paragraphs[0].add_run(r_scope)
        c2.paragraphs[0].add_run(r_routes)
    format_table(roles_table, header_bg="1E293B", alt_bg="F8FAFC")

    add_callout(
        doc,
        "Privilege Escalation Defense: The public.profiles table enforces column protection triggers. "
        "Users cannot alter their own role, tenant_id, or is_active flag via client-side request manipulation. "
        "Any role promotion requires direct Super Admin intervention.",
        title="SECURITY GUARANTEE",
        border_color="DC2626",
        bg_color="FEF2F2"
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 2: ACCESS & REGISTRATION
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("2. Platform Access, Registration & Authentication")
    
    add_h2("2.1 System Requirements & Access Points")
    p = doc.add_paragraph()
    p.add_run(
        "HackBridge is accessible via any modern Chromium, Gecko, or WebKit browser (Chrome 100+, Edge 100+, "
        "Firefox 100+, Safari 15+). The pilot platform URL is configured for the MITT tenant environment. "
        "Navigate to the application root to load the landing page and authentication gateway."
    )

    add_h2("2.2 Student Self-Registration Workflow")
    p = doc.add_paragraph()
    p.add_run("Students follow an automated self-service onboarding flow:")
    
    steps_student = [
        ("Step 1 — Navigate to Sign Up", "Click the 'Sign In' button on the landing page top navigation and select 'Create an account' at the bottom of the auth modal."),
        ("Step 2 — Select Student Role", "Ensure the role selector is set to 'Student' (the platform whitelist allows self-service student registrations)."),
        ("Step 3 — Input College Email & Password", "Enter your official institutional email (e.g., student@mitt.edu.in) and a secure password (minimum 8 characters with numbers and symbols)."),
        ("Step 4 — Tenant Domain Resolution", "The server automatically inspects your email domain against registered university tenants. Institutional domains are mapped directly to MITT."),
        ("Step 5 — Automatic Workspace Provisioning", "Upon confirmation, your profile is created with student privileges, and you are automatically routed to the Student Dashboard (/student)."),
    ]
    for s_title, s_desc in steps_student:
        p_step = doc.add_paragraph()
        r_step = p_step.add_run(f"• {s_title}: ")
        r_step.bold = True
        p_step.add_run(s_desc)

    add_h2("2.3 Corporate Partner & Recruiter Onboarding")
    p = doc.add_paragraph()
    p.add_run(
        "Company representatives follow a two-tier verification workflow to safeguard student data "
        "and maintain challenge statement integrity:"
    )
    
    steps_comp = [
        ("Registration", "Company representatives sign up selecting the 'Company Representative' role with corporate work email addresses."),
        ("Company Profile Initialization", "Upon initial login, complete the company profile form specifying Company Name, Industry Domain, Website URL, Tier Sponsorship, and Company Logo."),
        ("Administrative Verification Gate", "The account is marked 'Pending Verification'. The College Admin inspects the company credentials in the Admin Verification Desk (/admin/companies)."),
        ("Activation", "Once approved by the College Admin, the recruiter gains full access to post challenge statements and scout the Student Talent Pool."),
    ]
    for s_title, s_desc in steps_comp:
        p_step = doc.add_paragraph()
        r_step = p_step.add_run(f"• {s_title}: ")
        r_step.bold = True
        p_step.add_run(s_desc)

    add_h2("2.4 Evaluator & Committee Onboarding")
    p = doc.add_paragraph()
    p.add_run(
        "Evaluator and Committee Member accounts are typically provisioned by the College Admin or onboarded "
        "via official institutional invitations to ensure double-blind judging credentials are fully validated."
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 3: GLOBAL INTERFACE & SHARED TOOLS
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("3. Global Interface & Shared Tools")
    
    add_h2("3.1 Role-Aware Dynamic Sidebar")
    p = doc.add_paragraph()
    p.add_run(
        "The left sidebar dynamically adjusts its navigation hierarchy based on the active authenticated user's "
        "role. High-tier features display version tags (e.g., Phase 5, Phase 6, Phase 11) for full transparency."
    )

    add_h2("3.2 In-App Real-Time Notification Center")
    p = doc.add_paragraph()
    p.add_run(
        "The global notification bell is situated in the top header across all views. It connects directly "
        "to the public.notifications database table and provides real-time alerts for:"
    )
    p_notifs = [
        "Team invitations and member acceptance alerts",
        "Problem statement approvals or change requests",
        "Submission status changes, locking receipts, and AI pre-screening completion",
        "Evaluator scoring assignments and deliberation notices",
        "Recruiter interview invitations and official job/internship offers",
    ]
    for n in p_notifs:
        p_n = doc.add_paragraph()
        p_n.add_run(f"  - {n}")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 4: COLLEGE ADMIN MANUAL
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("4. College Administrator & Committee Guide")

    add_h2("4.1 Hackathon Lifecycle State Machine")
    p = doc.add_paragraph()
    p.add_run(
        "HackBridge enforces a strict database-level lifecycle state machine for all hackathons. "
        "Administrators transition events through distinct operational phases:"
    )

    lifecycle_table = doc.add_table(rows=8, cols=3)
    lifecycle_table.cell(0, 0).paragraphs[0].add_run("Status Stage")
    lifecycle_table.cell(0, 1).paragraphs[0].add_run("Operational Purpose")
    lifecycle_table.cell(0, 2).paragraphs[0].add_run("Permitted Stakeholder Actions")
    lifecycle_table.cell(0, 0).width = Inches(1.5)
    lifecycle_table.cell(0, 1).width = Inches(2.7)
    lifecycle_table.cell(0, 2).width = Inches(2.3)

    lc_data = [
        ("Draft", "Initial setup, date configuration, track formulation.", "Admins configure banner, rules, rubric, and team limits."),
        ("Problem Intake", "Corporate problem statement submission window.", "Verified companies submit challenge proposals for review."),
        ("Registration", "Student team enrollment & challenge locking.", "Students form teams, share invite codes, lock challenges."),
        ("Hacking", "Active coding sprint & deliverable development.", "Students push code, record demo videos, draft deliverables."),
        ("Evaluation", "Submissions locked; judging & AI triage active.", "Evaluators score submissions double-blind; committee deliberates."),
        ("Completed", "Official championship results finalized.", "Live leaderboard announced; podium medals and awards published."),
        ("Archived", "Historical record preservation.", "Read-only access for institutional auditing and recruiter scouting."),
    ]
    for idx, (st, purp, acts) in enumerate(lc_data, start=1):
        c0 = lifecycle_table.cell(idx, 0)
        c1 = lifecycle_table.cell(idx, 1)
        c2 = lifecycle_table.cell(idx, 2)
        c0.width = Inches(1.5)
        c1.width = Inches(2.7)
        c2.width = Inches(2.3)
        c0.paragraphs[0].add_run(st).bold = True
        c1.paragraphs[0].add_run(purp)
        c2.paragraphs[0].add_run(acts)
    format_table(lifecycle_table, header_bg="1E293B", alt_bg="F8FAFC")

    add_h2("4.2 Creating & Configuring a New Hackathon")
    p = doc.add_paragraph()
    p.add_run(
        "To initialize a new event, navigate to 'Hackathons' (/admin/hackathons) and click 'Create Hackathon'. "
        "The Phase 2B Hackathon Form requires the following configuration matrices:"
    )
    p_fields = [
        ("Event Identity: ", "Title, description, slug, banner image, and university department tracking."),
        ("Timeline Schedule: ", "Registration start/end, hacking start/end, and judging/evaluation deadlines."),
        ("Team Size Constraints: ", "Set minimum (e.g., 2) and maximum (e.g., 4) member thresholds per team."),
        ("Challenge Tracks: ", "Specify technical focus areas (AI/ML, Healthcare, FinTech, CyberSecurity, AgriTech)."),
        ("Dynamic Rubric Matrix: ", "Configure scoring criteria (e.g., Innovation, Technical Execution, Impact) with percentage weightings totaling exactly 100%."),
    ]
    for f_title, f_desc in p_fields:
        p_f = doc.add_paragraph()
        r_f = p_f.add_run(f"• {f_title}")
        r_f.bold = True
        p_f.add_run(f_desc)

    add_h2("4.3 Problem Statement Committee Review Desk")
    p = doc.add_paragraph()
    p.add_run(
        "Navigate to '/admin/problems'. All challenge statements submitted by industry partners appear in a review queue. "
        "Committee members can inspect problem descriptions, technical requirements, and target outcomes. "
        "Actions include:"
    )
    p_acts = [
        ("Approve & Publish: ", "Approves the statement and publishes it to the student challenge catalog."),
        ("Request Revisions: ", "Provides actionable committee feedback to the company representative."),
        ("Reject: ", "Declines problems that do not align with academic difficulty standards or university guidelines."),
    ]
    for a_title, a_desc in p_acts:
        p_a = doc.add_paragraph()
        r_a = p_a.add_run(f"• {a_title}")
        r_a.bold = True
        p_a.add_run(a_desc)

    add_h2("4.4 AI Pre-Screening & Triage Desk")
    p = doc.add_paragraph()
    p.add_run(
        "Located at '/admin/prescreening', this desk provides automated heuristic and natural language screening "
        "of all finalized project submissions before human judging begins."
    )
    add_callout(
        doc,
        "Understanding Pre-Screening Data Population:\n"
        "• The triage desk only queries submissions with is_final = true. Drafts currently being iterated by students are omitted.\n"
        "• When a student team clicks 'Lock & Finalize' in their portal, the AI screening pipeline triggers automatically.\n"
        "• Administrators can trigger 'Batch Screen All' or run single-submission audits at any time.\n"
        "• If the list is empty, verify that the active hackathon has finalized submissions in the database.",
        title="ADMIN NOTE — AI PRE-SCREENING",
        border_color="4F46E5",
        bg_color="EEF2FF"
    )

    add_h2("4.5 Judging Standings Matrix & Championship Awards")
    p = doc.add_paragraph()
    p.add_run(
        "Located at '/admin/results', this desk tracks double-blind evaluator scoring progress in real time. "
        "Administrators can inspect weighted score averages, jury recommendation tallies (Advance / Borderline / Reject), "
        "and score variance alerts indicating divergent judge opinions. When judging completes, administrators click "
        "'Finalize Hackathon Awards' to execute the server RPC, assign official podium ranks, and announce the results."
    )

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 5: STUDENT MANUAL
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("5. Student & Participant Guide")

    add_h2("5.1 Profile & Verified Talent Portfolio (/student/portfolio)")
    p = doc.add_paragraph()
    p.add_run(
        "Your portfolio is your professional calling card visible to verified corporate recruiters and public visitors. "
        "To maximize recruiter outreach opportunities, complete the following sections:"
    )
    p_port = [
        ("Academic Credentials: ", "College/University, Degree Major, Graduation Year, and verified CGPA."),
        ("Technical Skill Chips: ", "Add programming languages, frameworks, and tools (e.g., Python, PyTorch, React, Go)."),
        ("Public Repositories & Profiles: ", "Link your GitHub handle and LinkedIn profile."),
        ("Resume Upload: ", "Upload your PDF resume (up to 10MB) directly to the student-resumes Supabase Storage bucket."),
        ("Verified Hackathon Badges: ", "Awards, podium placements, and completed hackathons are automatically stamped onto your portfolio by the system."),
    ]
    for p_title, p_desc in p_port:
        p_p = doc.add_paragraph()
        r_p = p_p.add_run(f"• {p_title}")
        r_p.bold = True
        p_p.add_run(p_desc)

    add_h2("5.2 Team Formation & Invitation Desk (/student/teams)")
    p = doc.add_paragraph()
    p.add_run(
        "Students participate in hackathons as teams. The team desk enables fluid collaboration:"
    )
    team_opts = [
        ("Option A — Create a New Team: ", "Specify Team Name and Project Pitch. The system generates a unique invite code (e.g., TEAM-A8F2K9). Share this code with your college peers."),
        ("Option B — Join via Invite Code: ", "Enter the 6-to-10 character invite code provided by your team leader and click 'Join Team' to immediately enroll in the roster."),
        ("Team Leader Controls: ", "The team creator can transfer leadership or remove inactive members before the registration window closes."),
    ]
    for t_title, t_desc in team_opts:
        p_t = doc.add_paragraph()
        r_t = p_t.add_run(f"• {t_title}")
        r_t.bold = True
        p_t.add_run(t_desc)

    add_h2("5.3 Challenge Track Selection (/student/problems)")
    p = doc.add_paragraph()
    p.add_run(
        "Browse published industry challenges. Filter by track (AI, FinTech, Healthcare, Smart Cities). "
        "Once your team chooses an objective, click 'Lock Challenge for Team'. This selection establishes the "
        "semantic benchmark against which the AI Pre-Screening engine evaluates your deliverables."
    )

    add_h2("5.4 Deliverables & Submission Desk (/student/submissions)")
    p = doc.add_paragraph()
    p.add_run(
        "The submission desk supports multi-format project artifacts. Required deliverables include:"
    )
    delivs = [
        ("Project Title & Executive Abstract: ", "Clear problem summary and value proposition (minimum 50 words)."),
        ("Technical Approach Write-Up: ", "Detailed explanation of architecture, algorithms, and system design."),
        ("Source Code Repository URL: ", "Verified GitHub, GitLab, or Bitbucket repository link."),
        ("Live Deployment Demo URL: ", "Working web application, mobile APK link, or hosted service."),
        ("Presentation Pitch Deck: ", "Uploaded PDF slide deck or Google Slides link."),
        ("Video Demonstration URL: ", "Loom, YouTube, or Drive video walkthrough (under 3 minutes)."),
    ]
    for d_title, d_desc in delivs:
        p_d = doc.add_paragraph()
        r_d = p_d.add_run(f"• {d_title}")
        r_d.bold = True
        p_d.add_run(d_desc)

    add_callout(
        doc,
        "Drafting vs. Final Locking:\n"
        "• Click 'Save Draft' to persist partial progress without locking. Drafts are private to your team.\n"
        "• Click 'Lock & Finalize Submission' to submit your project. Once finalized, deliverables become IMMUTABLE "
        "and cannot be edited. Finalizing automatically launches the AI Pre-Screening audit and generates your readiness scorecard.",
        title="IMPORTANT — SUBMISSION IMMUTABILITY",
        border_color="D97706",
        bg_color="FFFBEB"
    )

    add_h2("5.5 Career Opportunities & Recruiter Offers (/student/offers)")
    p = doc.add_paragraph()
    p.add_run(
        "Corporate partners scout participants during and after hackathons. In the Offers Desk, students can:"
    )
    p_offers = [
        "Review interview invitations with job position titles, salary/stipend details, and custom recruiter notes",
        "Accept or decline invitations directly with a single click",
        "View company profile details and official recruiter contact channels",
    ]
    for o in p_offers:
        p_o = doc.add_paragraph()
        p_o.add_run(f"  - {o}")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 6: COMPANY RECRUITER MANUAL
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("6. Industry Partner & Recruiter Guide")

    add_h2("6.1 Corporate Profile Setup (/company/profile)")
    p = doc.add_paragraph()
    p.add_run(
        "Keep company metadata up to date, including corporate logo, career portal links, and partner tier. "
        "A well-maintained company profile builds credibility with participating student engineers."
    )

    add_h2("6.2 Problem Statement Submission (/company/problems)")
    p = doc.add_paragraph()
    p.add_run(
        "Submit real-world engineering problem statements to sponsored hackathons. Include:"
    )
    p_ps = [
        ("Title & Domain: ", "Concise technical challenge statement and category track."),
        ("Background Context: ", "Industry pain point, user persona context, and operational bottlenecks."),
        ("Expected Deliverables: ", "Core features, API schemas, and deployment targets required for success."),
        ("Evaluation Rubric Priorities: ", "Highlight whether your company prioritizes performance, UX, or algorithms."),
        ("Prize & Bounty Sponsorship: ", "Specify cash prizes, mentorship credits, or fast-track interview opportunities."),
    ]
    for ps_t, ps_d in p_ps:
        p_ps_item = doc.add_paragraph()
        r_ps_item = p_ps_item.add_run(f"• {ps_t}")
        r_ps_item.bold = True
        p_ps_item.add_run(ps_d)

    add_h2("6.3 Candidate Scouting & Talent Pool (/company/talent)")
    p = doc.add_paragraph()
    p.add_run(
        "The Talent Pool desk allows verified recruiters to search and filter top student engineers across the tenant:"
    )
    p_scout = [
        ("Multi-Dimensional Filters: ", "Filter candidates by verified hackathon awards (Winners, Runners-up, Finalists), technical skills, minimum CGPA, and graduation year."),
        ("Verified Portfolio Inspection: ", "Click any student profile to inspect verified credentials, submitted code repositories, demo links, and uploaded resumes."),
        ("Candidate Outreach: ", "Initiate outreach by selecting candidate status ('Interested', 'Interviewing', 'Offered') and sending official invitation messages with role descriptions."),
    ]
    for sc_t, sc_d in p_scout:
        p_sc = doc.add_paragraph()
        r_sc = p_sc.add_run(f"• {sc_t}")
        r_sc.bold = True
        p_sc.add_run(sc_d)

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 7: EVALUATOR MANUAL
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("7. Evaluator (Judge) Guide")

    add_h2("7.1 Double-Blind Evaluation Protocol")
    p = doc.add_paragraph()
    p.add_run(
        "To ensure complete impartiality, HackBridge enforces double-blind evaluation. In the Evaluator Queue "
        "(/evaluator/assignments):"
    )
    p_blind = [
        ("Anonymized Submission IDs: ", "Student names, team titles, and university affiliations are masked (e.g., Entry #SUB-9E4B1A)."),
        ("Evaluator Isolation: ", "Evaluators cannot see scores or comments submitted by other judges until deliberation concludes."),
        ("Student Shielding: ", "Students cannot see evaluator identities, individual scores, or internal committee notes."),
    ]
    for b_t, b_d in p_blind:
        p_b = doc.add_paragraph()
        r_b = p_b.add_run(f"• {b_t}")
        r_b.bold = True
        p_b.add_run(b_d)

    add_h2("7.2 Conflict of Interest (COI) Recusal Protocol")
    p = doc.add_paragraph()
    p.add_run(
        "If an evaluator recognizes a project, possesses personal affiliation with team members, or has mentored "
        "an entry, they must trigger the Conflict of Interest flow:"
    )
    p_coi = [
        ("Click 'Declare Conflict of Interest' on the assignment card or scoring page."),
        ("Input a mandatory, detailed reason explaining the conflict for committee audit."),
        ("Confirm recusal. The assignment is immediately removed from your active queue and marked 'Recused'."),
    ]
    for c in p_coi:
        p_c = doc.add_paragraph()
        p_c.add_run(f"  {c}")

    add_h2("7.3 Dynamic Rubric Scoring Workspace (/evaluator/score/:id)")
    p = doc.add_paragraph()
    p.add_run(
        "The scoring workspace dynamically renders evaluation criteria sliders parsed directly from the hackathon's "
        "configuration matrix (e.g., Technical Execution, Innovation, UI/UX Design, Business Viability). "
        "As sliders are adjusted, the platform calculates the composite weighted score in real time."
    )
    p_fb = [
        ("Strengths & Weaknesses: ", "Bullet points highlighting standout achievements and architectural bottlenecks."),
        ("Public Feedback: ", "Constructive commentary visible to students after the hackathon concludes."),
        ("Private Notes: ", "Confidential evaluations visible exclusively to the College Admin and Committee."),
        ("Recommendation Vote: ", "Cast your vote: Advance (Promote to finals), Borderline (Requires committee deliberation), or Reject."),
    ]
    for fb_t, fb_d in p_fb:
        p_fb_item = doc.add_paragraph()
        r_fb_item = p_fb_item.add_run(f"• {fb_t}")
        r_fb_item.bold = True
        p_fb_item.add_run(fb_d)

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 8: LEADERBOARD & AWARDS
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("8. Public Championship Leaderboard")
    
    p = doc.add_paragraph()
    p.add_run(
        "The Championship Leaderboard (/leaderboard) is the public showpiece of the hackathon platform. "
        "During the hacking and evaluation phases, the leaderboard displays live judging standings (or is hidden "
        "based on admin privacy settings). Once the College Admin clicks 'Finalize Awards', the leaderboard transitions "
        "to the Official Championship State:"
    )
    p_lead = [
        ("Top-3 Championship Podium: ", "Interactive 3D-styled cards showcasing the Gold Champion 🥇, Silver Runner-Up 🥈, and Bronze 🥉 teams with trophy badges."),
        ("Dense Rank Computation: ", "Official PostgreSQL DENSE_RANK() computation handling equal scores gracefully."),
        ("Challenge Track Filters: ", "Filter winners by challenge tracks (AI/ML, Healthcare, FinTech, Open Innovation)."),
        ("Project Showcase Modal: ", "Click any entry to inspect project abstracts, tech stacks, live demo links, and GitHub repositories."),
    ]
    for l_t, l_d in p_lead:
        p_l = doc.add_paragraph()
        r_l = p_l.add_run(f"• {l_t}")
        r_l.bold = True
        p_l.add_run(l_d)

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 9: SECURITY & AUDIT
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("9. Institutional Compliance, Audit Trail & Security")

    add_h2("9.1 Immutable Audit Logging (/admin/audit)")
    p = doc.add_paragraph()
    p.add_run(
        "HackBridge maintains a persistent, tamper-proof operational ledger in the public.audit_logs table. "
        "The following administrative and student actions are automatically recorded with actor ID, IP metadata, "
        "action type, and JSONB payloads:"
    )
    p_logs = [
        "Hackathon creation, status transition, and rubric modification",
        "Company partner verification and rejection decisions",
        "Problem statement approvals, modifications, and publications",
        "Team creation, invite code generation, and challenge locking",
        "Submission creation, draft autosaves, and final locking events",
        "AI Pre-Screening single runs and batch pipeline executions",
        "Evaluator assignments, score submissions, and COI recusals",
        "Award finalization and official leaderboard announcement",
    ]
    for l in p_logs:
        p_lg = doc.add_paragraph()
        p_lg.add_run(f"  - {l}")

    add_h2("9.2 Supabase Storage Bucket Isolation")
    p = doc.add_paragraph()
    p.add_run(
        "All binary assets are stored in dedicated Supabase Storage buckets governed by strict Row Level Security:"
    )
    storage_table = doc.add_table(rows=6, cols=3)
    storage_table.cell(0, 0).paragraphs[0].add_run("Storage Bucket")
    storage_table.cell(0, 1).paragraphs[0].add_run("Max File Size & Allowed MIME Types")
    storage_table.cell(0, 2).paragraphs[0].add_run("Access Permissions")
    storage_table.cell(0, 0).width = Inches(1.8)
    storage_table.cell(0, 1).width = Inches(2.7)
    storage_table.cell(0, 2).width = Inches(2.0)

    st_data = [
        ("hackathon-banners", "5 MB | JPEG, PNG, WebP", "Public Read; Admin Write"),
        ("company-logos", "2 MB | JPEG, PNG, SVG, WebP", "Public Read; Company Rep & Admin Write"),
        ("problem-attachments", "15 MB | PDF, ZIP, DOCX", "Authenticated Read; Company Rep & Admin Write"),
        ("student-submissions", "25 MB | PDF, ZIP, PNG, JPEG", "Private; Team Members Write; Judges & Admins Read"),
        ("student-resumes", "10 MB | PDF only", "Private; Student Write; Verified Recruiters & Admins Read"),
    ]
    for idx, (b_name, b_limits, b_perms) in enumerate(st_data, start=1):
        c0 = storage_table.cell(idx, 0)
        c1 = storage_table.cell(idx, 1)
        c2 = storage_table.cell(idx, 2)
        c0.width = Inches(1.8)
        c1.width = Inches(2.7)
        c2.width = Inches(2.0)
        c0.paragraphs[0].add_run(b_name).bold = True
        c1.paragraphs[0].add_run(b_limits)
        c2.paragraphs[0].add_run(b_perms)
    format_table(storage_table, header_bg="1E293B", alt_bg="F8FAFC")

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 10: TROUBLESHOOTING & FAQS
    # ──────────────────────────────────────────────────────────────────────────
    add_h1("10. Troubleshooting, Technical Reference & FAQs")

    faq_items = [
        ("Q1: Why is my AI Pre-Screening dashboard empty in the Admin console?",
         "AI Pre-Screening only evaluates submissions with is_final = true. If no student teams have clicked 'Lock & Finalize' "
         "for the selected hackathon yet, the queue will display zero submissions. Verify that the correct hackathon is selected "
         "in the dropdown and that student teams have submitted finalized deliverables."),
        ("Q2: A student team locked their submission accidentally. Can they re-open it?",
         "By design, finalized submissions are immutable to prevent tampering during active judging. However, a College Administrator "
         "can use the admin console or SQL update to toggle is_final back to false in exceptional circumstances before evaluation begins."),
        ("Q3: Why can't a company representative scout the talent pool?",
         "Company accounts must be explicitly verified by a College Administrator in the '/admin/companies' verification desk. "
         "Once the status is transitioned from 'pending' to 'verified', talent pool search and outreach features become active."),
        ("Q4: An evaluator has a personal connection to a team. How is impartiality preserved?",
         "The evaluator must navigate to their assignment and click 'Declare Conflict of Interest'. Submitting the recusal immediately "
         "re-queues the project for reassignment to another judge and preserves audit compliance."),
        ("Q5: What are the file upload restrictions for project deliverables?",
         "The student-submissions bucket accepts files up to 25MB in PDF, ZIP, PNG, and JPEG formats. For code repositories and demo videos, "
         "teams should provide valid GitHub and YouTube/Loom URLs, which are automatically verified by the URL validation layer."),
        ("Q6: How does HackBridge resolve tenant isolation during sign up?",
         "The system checks the user's email domain against the tenant's allowed domain whitelist. For MITT, '@mitt.edu.in' emails "
         "are automatically bound to the MITT tenant. External corporate partners are mapped based on their company profile registration."),
    ]

    for q, a in faq_items:
        add_h2(q)
        p_ans = doc.add_paragraph()
        p_ans.add_run(a)

    # Summary callout
    add_callout(
        doc,
        "Need Technical Support or Tenant Customization?\n"
        "Contact the Maharaja Institute of Technology Thandavapura Hackathon Operations Committee or system administrators at "
        "hackathons@mitt.edu.in. For multi-university white-label deployment inquiries, consult the HackBridge Deployment Architecture.",
        title="SUPPORT & CONTACT",
        border_color="0D9488",
        bg_color="F0FDFA"
    )

    output_path = r"e:\MITT PROJECT\V2\HackBridge_User_Manual.docx"
    doc.save(output_path)
    print(f"Successfully generated: {output_path}")

if __name__ == "__main__":
    build_manual()
